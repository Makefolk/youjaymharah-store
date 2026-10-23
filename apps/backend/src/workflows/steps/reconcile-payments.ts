import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { PAYMENT_RECONCILIATION_MODULE } from "../../modules/payment-reconciliation";
import type PaymentReconciliationModuleService from "../../modules/payment-reconciliation/service";
import {
  checkWithGateway,
  getPaymentVerdict,
} from "../../modules/payments/lookup";
import { toMinorUnit } from "../../modules/payments/shared/amount";

const MINUTE_MS = 60 * 1000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const GATEWAYS = ["pp_paystack_paystack", "pp_credo_credo"];

/** A paid bag normally becomes an order within minutes; give it this long. */
export const PAYMENT_GRACE_MS = 20 * MINUTE_MS;
/** Where tracking starts on the very first run. */
const FIRST_LOOKBACK_MS = 7 * DAY_MS;
/** An attempt still unfinished after this goes to staff. */
const ESCALATE_AFTER_MS = 7 * DAY_MS;
/** New attempts added per run; the rest wait for the next run. */
const ENQUEUE_BATCH = 500;
/** Gateway checks per run, to stay well inside their rate limits. */
const CHECK_BATCH = 25;
/** Waits between checks of an unfinished attempt. */
const BACKOFF_MS = [
  10 * MINUTE_MS,
  30 * MINUTE_MS,
  60 * MINUTE_MS,
  3 * 60 * MINUTE_MS,
  6 * 60 * MINUTE_MS,
  12 * 60 * MINUTE_MS,
  DAY_MS,
];
/** How often a flagged attempt is looked at again for an order. */
const FLAGGED_RECHECK_MS = 5 * MINUTE_MS;

const service = (container: MedusaContainer) =>
  container.resolve<PaymentReconciliationModuleService>(
    PAYMENT_RECONCILIATION_MODULE,
  );

/**
 * Starts tracking gateway payment attempts made since the newest one already
 * tracked, once they are past the grace period. Every attempt with a
 * gateway reference is added, including several for one bag.
 */
export const enqueuePaymentChecksStep = createStep(
  "enqueue-payment-checks",
  async (_: undefined, { container }) => {
    const checks = service(container);
    const [newest] = await checks.listPaymentChecks(
      {},
      { take: 1, order: { session_created_at: "DESC" } },
    );
    const now = Date.now();
    const since = newest
      ? new Date(newest.session_created_at)
      : new Date(now - FIRST_LOOKBACK_MS);

    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const { data: sessions } = await query.graph({
      entity: "payment_session",
      fields: [
        "id",
        "provider_id",
        "amount",
        "currency_code",
        "data",
        "created_at",
        "payment_collection.cart.id",
        "payment_collection.cart.email",
      ],
      filters: {
        provider_id: GATEWAYS,
        created_at: {
          $gte: since.toISOString(),
          $lte: new Date(now - PAYMENT_GRACE_MS).toISOString(),
        },
      },
      pagination: { take: ENQUEUE_BATCH, order: { created_at: "ASC" } },
    });

    const withReference = sessions.filter(
      (session: any) => typeof session.data?.reference === "string",
    );
    const known = new Set(
      withReference.length
        ? (
            await checks.listPaymentChecks(
              { session_id: withReference.map((session: any) => session.id) },
              { select: ["session_id"] },
            )
          ).map((check) => check.session_id)
        : [],
    );
    const fresh = withReference.filter(
      (session: any) => !known.has(session.id),
    );
    if (!fresh.length) return new StepResponse({ added: 0 }, [] as string[]);

    const created = await checks.createPaymentChecks(
      fresh.map((session: any) => ({
        session_id: session.id,
        provider_id: session.provider_id,
        reference: session.data.reference as string,
        cart_id: session.payment_collection?.cart?.id ?? null,
        email: session.payment_collection?.cart?.email ?? null,
        amount: session.amount,
        currency_code: session.currency_code,
        session_created_at: new Date(session.created_at),
        next_check_at: new Date(now),
      })),
    );
    return new StepResponse(
      { added: created.length },
      created.map((check) => check.id),
    );
  },
  async (ids, { container }) => {
    if (ids?.length) await service(container).deletePaymentChecks(ids);
  },
);

/**
 * Whether an attempt's bag became an order, and the session's current
 * gateway data (Credo adds its own reference after the attempt starts).
 */
async function loadAttempt(container: MedusaContainer, sessionId: string) {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const {
    data: [session],
  } = await query.graph({
    entity: "payment_session",
    fields: [
      "id",
      "data",
      "payment_collection.order.id",
      "payment_collection.cart.completed_at",
    ],
    filters: { id: sessionId },
  });
  const collection = (session as any)?.payment_collection;
  return {
    ordered: Boolean(collection?.order?.id || collection?.cart?.completed_at),
    data: ((session as any)?.data ?? null) as Record<string, unknown> | null,
  };
}

/**
 * Checks the attempts that are due: those that became orders or failed are
 * resolved; paid ones without an order go to staff; unfinished ones are
 * checked again later, and go to staff after a week. Flagged attempts are
 * only looked at for an order, so staff creating one clears them.
 *
 * Not compensated: each update records what a gateway said, and a later
 * failure is no reason to forget it.
 */
export const checkDuePaymentsStep = createStep(
  "check-due-payments",
  async (_: undefined, { container }) => {
    const checks = service(container);
    const now = new Date();
    const due = await checks.listPaymentChecks(
      {
        status: ["checking", "needs_staff"],
        next_check_at: { $lte: now },
      },
      { take: CHECK_BATCH, order: { next_check_at: "ASC" } },
    );

    const counts = { checked: 0, resolved: 0, flagged: 0 };
    for (const check of due) {
      counts.checked++;
      const { ordered, data } = await loadAttempt(container, check.session_id);
      if (ordered) {
        await checks.updatePaymentChecks({
          id: check.id,
          status: "resolved",
          verdict: "order_placed",
          resolution: "order_placed",
          resolved_at: now,
          last_checked_at: now,
          next_check_at: null,
        });
        counts.resolved++;
        continue;
      }

      if (
        check.status === "needs_staff" &&
        check.verdict !== "pending" &&
        check.verdict !== "unknown"
      ) {
        await checks.updatePaymentChecks({
          id: check.id,
          last_checked_at: now,
          next_check_at: new Date(now.getTime() + FLAGGED_RECHECK_MS),
        });
        continue;
      }

      const gateway = await checkWithGateway(
        check.provider_id,
        data ?? { reference: check.reference },
      );
      const verdict = getPaymentVerdict({
        hasOrder: false,
        gateway,
        expectedMinor: toMinorUnit(check.amount, check.currency_code),
        expectedCurrency: check.currency_code,
      });
      const attempts = check.attempts + 1;

      if (verdict === "not_paid") {
        await checks.updatePaymentChecks({
          id: check.id,
          status: "resolved",
          verdict,
          resolution: "not_paid",
          resolved_at: now,
          attempts,
          last_checked_at: now,
          next_check_at: null,
        });
        counts.resolved++;
      } else if (verdict === "paid_no_order" || verdict === "amount_mismatch") {
        await checks.updatePaymentChecks({
          id: check.id,
          status: "needs_staff",
          verdict,
          attempts,
          last_checked_at: now,
          next_check_at: new Date(now.getTime() + FLAGGED_RECHECK_MS),
        });
        counts.flagged++;
      } else {
        // pending, or the gateway couldn't be asked: try again later.
        const age =
          now.getTime() - new Date(check.session_created_at).getTime();
        const escalate = age >= ESCALATE_AFTER_MS;
        await checks.updatePaymentChecks({
          id: check.id,
          status: escalate ? "needs_staff" : "checking",
          verdict,
          attempts,
          last_checked_at: now,
          next_check_at: new Date(
            now.getTime() +
              BACKOFF_MS[Math.min(attempts - 1, BACKOFF_MS.length - 1)],
          ),
        });
        if (escalate) counts.flagged++;
      }
    }
    return new StepResponse(counts);
  },
);

export type ResolvePaymentCheckInput = {
  id: string;
  resolved_by: string;
  note: string;
};

/** Staff mark a flagged attempt handled, saying what they did. */
export const resolvePaymentCheckStep = createStep(
  "resolve-payment-check",
  async (input: ResolvePaymentCheckInput, { container }) => {
    const checks = service(container);
    const previous = await checks.retrievePaymentCheck(input.id);
    const updated = await checks.updatePaymentChecks({
      id: input.id,
      status: "resolved",
      resolution: "handled",
      resolved_at: new Date(),
      resolved_by: input.resolved_by,
      note: input.note,
      next_check_at: null,
    });
    return new StepResponse(updated, {
      id: previous.id,
      status: previous.status,
      resolution: previous.resolution,
      resolved_at: previous.resolved_at,
      resolved_by: previous.resolved_by,
      note: previous.note,
      next_check_at: previous.next_check_at,
    });
  },
  async (previous, { container }) => {
    if (previous) await service(container).updatePaymentChecks(previous);
  },
);
