import type {
  ICachingModuleService,
  MedusaContainer,
} from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

import {
  checkWithGateway,
  getPaymentVerdict,
  type PaymentVerdict,
} from "../../modules/payments/lookup";
import { toMinorUnit } from "../../modules/payments/shared/amount";
import { SUPPORT_MODULE } from "../../modules/support";
import type SupportModuleService from "../../modules/support/service";
import { listEmailReviewQueue } from "./email-review";

const DAY_MS = 24 * 60 * 60 * 1000;
const GATEWAYS = ["pp_paystack_paystack", "pp_credo_credo"];

/** A paid bag normally becomes an order within minutes; give it this long. */
const PAYMENT_GRACE_MS = 20 * 60 * 1000;
/** Older payment attempts are left to the payment lookup. */
const PAYMENT_LOOKBACK_MS = 3 * DAY_MS;
/** How many attempts to ask the gateways about per refresh. */
const PAYMENT_CHECK_LIMIT = 15;
const PAYMENT_CACHE_SECONDS = 5 * 60;
/** A requested return nobody has received for this long. */
export const RETURN_WAIT_DAYS = 3;
/** A paid order with nothing shipped for this long. */
export const SHIP_WAIT_DAYS = 3;

export type AttentionPayment = {
  session_id: string;
  reference: string | null;
  provider_id: string;
  amount: number;
  currency_code: string;
  email: string | null;
  created_at: string;
  verdict: Extract<
    PaymentVerdict,
    "paid_no_order" | "amount_mismatch" | "pending"
  >;
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
  returns: AttentionReturn[];
  unshipped: AttentionOrder[];
};

const iso = (value: unknown) => new Date(value as string).toISOString();

/**
 * Recent gateway payments whose bag never became an order, as the gateway
 * sees them now: paid (create the order), paid a different amount (refund),
 * or still unfinished. Bags never paid for are left out. Cached briefly, so
 * opening the page doesn't hit the gateways every time.
 */
async function paymentsNeedingAttention(
  container: MedusaContainer,
): Promise<AttentionPayment[]> {
  const cache: ICachingModuleService = container.resolve(Modules.CACHING);
  const key = "attention:payments";
  try {
    const hit = (await cache.get({ key })) as AttentionPayment[] | null;
    if (hit) return hit;
  } catch {
    // A cache outage only costs speed.
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const now = Date.now();
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
      "payment_collection.cart.completed_at",
      "payment_collection.order.id",
    ],
    filters: {
      provider_id: GATEWAYS,
      created_at: {
        $gte: new Date(now - PAYMENT_LOOKBACK_MS).toISOString(),
        $lte: new Date(now - PAYMENT_GRACE_MS).toISOString(),
      },
    },
    pagination: { take: 200, order: { created_at: "DESC" } },
  });

  // One attempt per bag: the newest, which is the one the shopper last paid.
  const seen = new Set<string>();
  const candidates = sessions.filter((session: any) => {
    const cart = session.payment_collection?.cart;
    if (!cart || cart.completed_at || session.payment_collection?.order)
      return false;
    if (!session.data?.reference || seen.has(cart.id)) return false;
    seen.add(cart.id);
    return true;
  });

  const checked = await Promise.all(
    candidates.slice(0, PAYMENT_CHECK_LIMIT).map(async (session: any) => {
      const gateway = await checkWithGateway(session.provider_id, session.data);
      const verdict = getPaymentVerdict({
        hasOrder: false,
        gateway,
        expectedMinor: toMinorUnit(session.amount, session.currency_code),
        expectedCurrency: session.currency_code,
      });
      return { session, verdict };
    }),
  );

  const result = checked
    .filter(
      (
        entry,
      ): entry is typeof entry & { verdict: AttentionPayment["verdict"] } =>
        ["paid_no_order", "amount_mismatch", "pending"].includes(entry.verdict),
    )
    .map(({ session, verdict }) => ({
      session_id: session.id,
      reference:
        typeof session.data?.reference === "string"
          ? session.data.reference
          : null,
      provider_id: session.provider_id,
      amount: Number(session.amount),
      currency_code: session.currency_code,
      email: session.payment_collection?.cart?.email ?? null,
      created_at: iso(session.created_at),
      verdict,
    }));

  try {
    await cache.set({ key, data: result, ttl: PAYMENT_CACHE_SECONDS });
  } catch {
    // As above.
  }
  return result;
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
    payments,
    returns,
    unshipped,
  };
}
