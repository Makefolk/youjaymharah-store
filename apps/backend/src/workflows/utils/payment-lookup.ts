import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

export type PaymentAttempt = {
  session_id: string;
  /** The reference on the customer's receipt; null if the page never opened. */
  reference: string | null;
  provider_id: string;
  status: string;
  amount: number;
  currency_code: string;
  created_at: string;
  cart: {
    id: string;
    email: string | null;
    completed_at: string | null;
  } | null;
  order: { id: string; display_id: number } | null;
};

const SESSION_FIELDS = [
  "id",
  "provider_id",
  "status",
  "amount",
  "currency_code",
  "data",
  "created_at",
  "payment_collection.cart.id",
  "payment_collection.cart.email",
  "payment_collection.cart.completed_at",
  "payment_collection.order.id",
  "payment_collection.order.display_id",
];

const iso = (value: unknown) =>
  value ? new Date(value as string).toISOString() : null;

function toAttempt(session: any): PaymentAttempt {
  const cart = session.payment_collection?.cart;
  const order = session.payment_collection?.order;
  const reference = session.data?.reference;
  return {
    session_id: session.id,
    reference: typeof reference === "string" ? reference : null,
    provider_id: session.provider_id,
    status: session.status,
    amount: Number(session.amount),
    currency_code: session.currency_code,
    created_at: iso(session.created_at)!,
    cart: cart
      ? {
          id: cart.id,
          email: cart.email ?? null,
          completed_at: iso(cart.completed_at),
        }
      : null,
    order: order ? { id: order.id, display_id: order.display_id } : null,
  };
}

/** One payment session with its cart and order, and its raw gateway data. */
export async function loadPaymentAttempt(
  container: MedusaContainer,
  sessionId: string,
): Promise<{ attempt: PaymentAttempt; data: Record<string, unknown> } | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const {
    data: [session],
  } = await query.graph({
    entity: "payment_session",
    fields: SESSION_FIELDS,
    filters: { id: sessionId },
  });
  return session
    ? {
        attempt: toAttempt(session),
        data: (session.data ?? {}) as Record<string, unknown>,
      }
    : null;
}

/**
 * Recent payment attempts on carts with this email, newest first: what to
 * look at when the customer has no reference to hand.
 */
export async function listPaymentAttemptsByEmail(
  container: MedusaContainer,
  email: string,
  limit = 20,
): Promise<PaymentAttempt[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data: carts } = await query.graph({
    entity: "cart",
    fields: ["id", "payment_collection.payment_sessions.id"],
    filters: {
      email: [...new Set([email.trim(), email.trim().toLowerCase()])],
    },
    pagination: { take: 20, order: { created_at: "DESC" } },
  });
  const ids = carts.flatMap((cart: any) =>
    (cart.payment_collection?.payment_sessions ?? []).map((s: any) => s.id),
  );
  if (!ids.length) return [];
  const { data: sessions } = await query.graph({
    entity: "payment_session",
    fields: SESSION_FIELDS,
    filters: { id: ids },
  });
  return sessions
    .map(toAttempt)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, limit);
}
