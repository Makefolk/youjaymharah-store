import type {
  PaymentActions,
  PaymentProviderContext,
} from "@medusajs/framework/types";

/**
 * Options every redirect-style gateway needs. Concrete providers extend this.
 */
export type RedirectProviderOptions = {
  /** Server-side key used for verify/refund calls. */
  secretKey: string;
  /**
   * Where the gateway sends the customer after they finish (or abandon) the
   * hosted payment page. Usually your storefront's checkout callback route.
   */
  callbackUrl?: string;
};

/**
 * What we persist on the PaymentSession's `data`.
 *
 * NOTE: this is readable by the storefront — never put keys or signatures here.
 */
export type RedirectSessionData = {
  /** Our reference, sent to the gateway. Alphanumeric only. */
  reference: string;
  /** The gateway's own reference, when it returns one distinct from ours. */
  gateway_reference?: string;
  /** Hosted payment page the storefront must redirect the customer to. */
  redirect_url: string;
  /** Medusa's payment session id, round-tripped through gateway metadata. */
  session_id: string;
  amount_in_minor: number;
  currency_code: string;
  /**
   * Guest contact details the storefront sent with the session. Kept so
   * updatePayment -- which only receives this stored data -- can re-initialize
   * the transaction for a guest.
   */
  payer?: Payer;
  /**
   * Staff must authorize recording separately from the gateway transfer.
   * Paystack verifies this receipt remotely; Credo relies on staff attestation.
   */
  dashboard_refund?: DashboardRefund | null;
};

export type DashboardRefund = {
  /** The refund's reference in the gateway's dashboard. */
  reference: string;
  amount_in_minor: number;
  /** The admin user recording it. */
  recorded_by: string;
};

/** Who the gateway should address the receipt to. */
export type Payer = {
  email?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
};

export type InitializeTransactionInput = {
  reference: string;
  amountInMinor: number;
  currencyCode: string;
  sessionId: string;
  context?: PaymentProviderContext;
  data?: Record<string, unknown>;
};

export type InitializedTransaction = {
  reference: string;
  gatewayReference?: string;
  redirectUrl: string;
};

/** Gateway-agnostic transaction state. */
export type NormalizedTransactionStatus =
  "pending" | "successful" | "failed" | "canceled";

export type NormalizedTransaction = {
  status: NormalizedTransactionStatus;
  reference?: string;
  amountInMinor?: number;
  currencyCode?: string;
  raw: Record<string, unknown>;
};

export type NormalizedWebhook = {
  action: PaymentActions;
  sessionId?: string;
  amountInMinor?: number;
  currencyCode?: string;
};
