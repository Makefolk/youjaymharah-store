import { CredoClient } from "./credo/client";
import { credoOptionsFromEnv, paystackOptionsFromEnv } from "./options";
import { PaystackClient } from "./paystack/client";
import type { RedirectSessionData } from "./shared/types";

/**
 * What support needs to answer "I paid but got no order": which Medusa
 * payment session a gateway reference belongs to, what the gateway says
 * about it now, and what to do.
 */

const ULID = "[0-9A-HJKMNP-TV-Z]{26}";

/**
 * The payment session behind a reference. Our references are the session id
 * without its underscore (amount.ts `toGatewayReference`), plus a short
 * suffix when the amount changed; customers see them on Paystack and Credo
 * receipts. A pasted session id works too. Null for anything else, such as
 * Credo's own transaction reference.
 */
export function parsePaymentReference(input: string): string | null {
  const match = input
    .trim()
    .match(new RegExp(`^payses_?(${ULID})[0-9a-z]*$`, "i"));
  return match ? `payses_${match[1].toUpperCase()}` : null;
}

export type GatewayStatus = "successful" | "pending" | "failed" | "canceled";

export type GatewayCheck =
  | {
      checked: true;
      status: GatewayStatus;
      amount_in_minor: number | null;
      currency_code: string | null;
    }
  | { checked: false; reason: string };

const GATEWAYS = ["pp_paystack_paystack", "pp_credo_credo"] as const;

export function isGatewayProvider(providerId: string): boolean {
  return (GATEWAYS as readonly string[]).includes(providerId);
}

/** Asks the gateway about a session's transaction, live. Never throws. */
export async function checkWithGateway(
  providerId: string,
  data: Record<string, unknown> | null | undefined,
): Promise<GatewayCheck> {
  const session = data as RedirectSessionData | null | undefined;
  if (!isGatewayProvider(providerId)) {
    return { checked: false, reason: "Not a Paystack or Credo payment." };
  }
  if (!session?.reference) {
    return {
      checked: false,
      reason:
        "The payment page was never opened, so there is nothing to check.",
    };
  }
  try {
    const result =
      providerId === "pp_paystack_paystack"
        ? await new PaystackClient(paystackOptionsFromEnv()).verify(
            session.reference,
          )
        : await new CredoClient(credoOptionsFromEnv()).verify(
            session.gateway_reference || session.reference,
          );
    return {
      checked: true,
      status: result.state,
      amount_in_minor: result.amountInMinor ?? null,
      currency_code: result.currencyCode?.toUpperCase() ?? null,
    };
  } catch (error) {
    return {
      checked: false,
      reason: `The gateway couldn't be reached or doesn't know this reference (${(error as Error).message.slice(0, 160)}).`,
    };
  }
}

/**
 * - order_placed: an order exists; nothing is missing.
 * - paid_no_order: the gateway took the money but no order was made. Support
 *   can create it from the cart.
 * - amount_mismatch: paid, but not the amount Medusa expected. Creating the
 *   order would be refused; refund it from the gateway's dashboard.
 * - pending: the gateway hasn't finished with it -- the customer may still be
 *   paying, a bank transfer may be on its way, or it is under review. It may
 *   yet succeed, so nobody should be told they weren't charged.
 * - not_paid: the gateway says it failed or was canceled. Nothing was charged.
 * - unknown: the gateway couldn't be asked.
 */
export type PaymentVerdict =
  | "order_placed"
  | "paid_no_order"
  | "amount_mismatch"
  | "pending"
  | "not_paid"
  | "unknown";

export function getPaymentVerdict({
  hasOrder,
  gateway,
  expectedMinor,
  expectedCurrency,
}: {
  hasOrder: boolean;
  gateway: GatewayCheck;
  expectedMinor: number | null;
  expectedCurrency: string | null;
}): PaymentVerdict {
  if (hasOrder) return "order_placed";
  if (!gateway.checked) return "unknown";
  if (gateway.status === "pending") return "pending";
  if (gateway.status !== "successful") return "not_paid";
  if (
    (expectedMinor !== null &&
      gateway.amount_in_minor !== null &&
      gateway.amount_in_minor !== expectedMinor) ||
    (expectedCurrency !== null &&
      gateway.currency_code !== null &&
      gateway.currency_code !== expectedCurrency.toUpperCase())
  ) {
    return "amount_mismatch";
  }
  return "paid_no_order";
}
