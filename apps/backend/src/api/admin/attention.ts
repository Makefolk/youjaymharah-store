import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import { PAYMENT_RECONCILIATION_MODULE } from "../../modules/payment-reconciliation";
import type PaymentReconciliationModuleService from "../../modules/payment-reconciliation/service";
import { SUPPORT_MODULE } from "../../modules/support";
import type SupportModuleService from "../../modules/support/service";
import { listEmailReviewQueue } from "./email-review";

const DAY_MS = 24 * 60 * 60 * 1000;
/** Flagged payments shown at most; the count says how many there are. */
const PAYMENT_LIMIT = 100;
/** A requested return nobody has received for this long. */
export const RETURN_WAIT_DAYS = 3;
/** A paid order with nothing shipped for this long. */
export const SHIP_WAIT_DAYS = 3;

export type AttentionPayment = {
  /** The payment check, for marking it handled. */
  id: string;
  session_id: string;
  reference: string | null;
  provider_id: string;
  amount: number;
  currency_code: string;
  email: string | null;
  created_at: string;
  /**
   * paid_no_order and amount_mismatch need staff; pending is still being
   * rechecked; stale has been unfinished (or uncheckable) for a week.
   */
  verdict: "paid_no_order" | "amount_mismatch" | "pending" | "stale";
};

export type AttentionReturn = {
  id: string;
  order_id: string;
  display_id: number;
  requested_at: string;
};

export type AttentionOrder = {
  id: string;
  display_id: number;
  email: string | null;
  created_at: string;
};

export type Attention = {
  /** Support requests waiting on staff. */
  support_open: number;
  emails_to_review: number;
  payments: AttentionPayment[];
  /** All flagged payments, when there are more than listed. */
  payments_count: number;
  returns: AttentionReturn[];
  unshipped: AttentionOrder[];
};

const iso = (value: unknown) => new Date(value as string).toISOString();

/**
 * Gateway payment attempts whose bag never became an order, as the payment
 * reconciliation job last found them (jobs/reconcile-payments.ts): paid
 * (create the order), paid a different amount (refund), still unfinished,
 * or unfinished for a week. Attempts that failed or became orders are not
 * listed.
 */
async function paymentsNeedingAttention(
  container: MedusaContainer,
): Promise<{ payments: AttentionPayment[]; count: number }> {
  const checks: PaymentReconciliationModuleService = container.resolve(
    PAYMENT_RECONCILIATION_MODULE,
  );
  const [rows, count] = await checks.listAndCountPaymentChecks(
    {
      $or: [
        { status: "needs_staff" },
        { status: "checking", verdict: "pending" },
      ],
    },
    { take: PAYMENT_LIMIT, order: { session_created_at: "DESC" } },
  );
  const verdictOf = (
    check: (typeof rows)[number],
  ): AttentionPayment["verdict"] =>
    check.verdict === "paid_no_order" || check.verdict === "amount_mismatch"
      ? check.verdict
      : check.status === "needs_staff"
        ? "stale"
        : "pending";
  const payments: AttentionPayment[] = rows.map((check) => ({
    id: check.id,
    session_id: check.session_id,
    reference: check.reference,
    provider_id: check.provider_id,
    amount: Number(check.amount),
    currency_code: check.currency_code,
    email: check.email,
    created_at: iso(check.session_created_at),
    verdict: verdictOf(check),
  }));
  return { payments, count };
}

async function waitingReturns(
  container: MedusaContainer,
): Promise<AttentionReturn[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data: returns } = await query.graph({
    entity: "return",
    fields: ["id", "status", "created_at", "order.id", "order.display_id"],
    filters: {
      status: "requested",
      created_at: {
        $lte: new Date(Date.now() - RETURN_WAIT_DAYS * DAY_MS).toISOString(),
      },
    },
    pagination: { take: 50, order: { created_at: "ASC" } },
  });
  return returns
    .filter((entry: any) => entry.order)
    .map((entry: any) => ({
      id: entry.id,
      order_id: entry.order.id,
      display_id: entry.order.display_id,
      requested_at: iso(entry.created_at),
    }));
}

const PAID = new Set([
  "authorized",
  "partially_authorized",
  "completed",
  "partially_captured",
  "captured",
  // Partly refunded can still be waiting to ship the rest.
  "partially_refunded",
]);

async function unshippedOrders(
  container: MedusaContainer,
): Promise<AttentionOrder[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const now = Date.now();
  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "status",
      "canceled_at",
      "created_at",
      "payment_collections.status",
      "fulfillments.shipped_at",
      "fulfillments.canceled_at",
    ],
    filters: {
      created_at: {
        // Older orders are long settled one way or another.
        $gte: new Date(now - 60 * DAY_MS).toISOString(),
        $lte: new Date(now - SHIP_WAIT_DAYS * DAY_MS).toISOString(),
      },
    },
    pagination: { take: 500, order: { created_at: "ASC" } },
  });
  return orders
    .filter(
      (order: any) =>
        !order.canceled_at &&
        order.status !== "canceled" &&
        order.status !== "draft" &&
        (order.payment_collections ?? []).some((collection: any) =>
          PAID.has(collection?.status),
        ) &&
        !(order.fulfillments ?? []).some(
          (fulfillment: any) =>
            fulfillment?.shipped_at && !fulfillment.canceled_at,
        ),
    )
    .slice(0, 50)
    .map((order: any) => ({
      id: order.id,
      display_id: order.display_id,
      email: order.email ?? null,
      created_at: iso(order.created_at),
    }));
}

/** Everything waiting on a person, for the admin's Needs attention page. */
export async function listAttention(
  container: MedusaContainer,
): Promise<Attention> {
  const support: SupportModuleService = container.resolve(SUPPORT_MODULE);
  const [[, supportOpen], emails, payments, returns, unshipped] =
    await Promise.all([
      support.listAndCountSupportRequests(
        { status: "open" },
        { take: 1, select: ["id"] },
      ),
      listEmailReviewQueue(container),
      paymentsNeedingAttention(container),
      waitingReturns(container),
      unshippedOrders(container),
    ]);
  return {
    support_open: supportOpen,
    emails_to_review: emails.count,
    payments: payments.payments,
    payments_count: payments.count,
    returns,
    unshipped,
  };
}
