import { createHash, createHmac, timingSafeEqual } from "node:crypto";

import { MedusaError } from "@medusajs/framework/utils";
import type {
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
} from "@medusajs/framework/types";

import { RedirectPaymentProvider } from "../shared/redirect-payment-provider";
import type { RedirectProviderDependencies } from "../shared/redirect-payment-provider";
import type {
  InitializedTransaction,
  InitializeTransactionInput,
  NormalizedTransaction,
  NormalizedWebhook,
  RedirectSessionData,
} from "../shared/types";
import { CredoClient, normalizeStatus } from "./client";
import { FeeBearerEnum, type CredoOptions, type PaymentChannel } from "./types";

const DEFAULT_CHANNELS: PaymentChannel[] = ["CARD", "BANK"];

/** Custom field we round-trip the Medusa session id through. */
const SESSION_FIELD = "medusa_session_id";

/** Credo's normalized states, as the actions Medusa acts on. */
const CREDO_STATE_ACTIONS: Record<
  NormalizedTransaction["status"],
  NormalizedWebhook["action"]
> = {
  successful: "captured",
  failed: "failed",
  canceled: "canceled",
  pending: "pending",
};

class CredoPaymentProvider extends RedirectPaymentProvider<CredoOptions> {
  static identifier = "credo";

  private readonly client: CredoClient;

  constructor(container: RedirectProviderDependencies, options: CredoOptions) {
    super(container, options);

    this.client = new CredoClient(options);
  }

  static validateOptions(options: Record<string, unknown>): void {
    for (const key of ["publicKey", "secretKey"]) {
      if (!options[key]) {
        throw new MedusaError(
          MedusaError.Types.INVALID_DATA,
          `Credo payment provider requires the "${key}" option.`,
        );
      }
    }

    if (options.mode && !["test", "live"].includes(options.mode as string)) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Credo "mode" must be "test" or "live", got "${options.mode}".`,
      );
    }
  }

  protected async initializeTransaction(
    input: InitializeTransactionInput,
  ): Promise<InitializedTransaction> {
    const payer = this.resolvePayer(input);
    const email = payer.email;

    if (!email) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Credo requires a customer email to initialize a transaction.",
      );
    }

    if (input.currencyCode !== "NGN" && input.currencyCode !== "USD") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Credo only supports NGN and USD, but the region is set to ${input.currencyCode}.`,
      );
    }

    const result = await this.client.initialize({
      amount: input.amountInMinor,
      email,
      customerFirstName: payer.first_name ?? undefined,
      customerLastName: payer.last_name ?? undefined,
      customerPhoneNumber: payer.phone ?? undefined,
      currency: input.currencyCode,
      reference: input.reference,
      callbackUrl: this.options_.callbackUrl,
      channel: this.options_.channels ?? DEFAULT_CHANNELS,
      bearer: this.options_.bearer ?? FeeBearerEnum.Merchant,
      initializeAccount: 0,
      serviceCode: this.options_.serviceCode,
      metadata: {
        // The webhook has to be able to name the Medusa session, and Credo's
        // metadata is a custom-field list rather than a free-form object.
        customFields: [
          {
            variable_name: SESSION_FIELD,
            value: input.sessionId,
            display_name: "Medusa Session ID",
          },
        ],
      },
    });

    return {
      reference: result.reference || input.reference,
      gatewayReference: result.gatewayReference,
      redirectUrl: result.redirectUrl,
    };
  }

  protected async verifyTransaction(
    session: RedirectSessionData,
  ): Promise<NormalizedTransaction> {
    // Credo's docs say to verify by its own reference where one was issued.
    const reference = session.gateway_reference || session.reference;
    const result = await this.client.verify(reference);

    return {
      status: result.state,
      reference:
        typeof result.raw.businessRef === "string"
          ? result.raw.businessRef
          : undefined,
      amountInMinor: result.amountInMinor,
      currencyCode: result.currencyCode,
      raw: result.raw,
    };
  }

  /**
   * Credo exposes no documented refund endpoint. Staff refund in the Credo
   * dashboard, then record it from the order page ("Record Credo refund"),
   * which authorizes exactly that amount first. Anything else is refused, so
   * the admin's ordinary Refund button can't mark an unpaid refund as done.
   */
  protected async refundTransaction({
    session,
    amountInMinor,
  }: {
    session: RedirectSessionData;
    amountInMinor: number;
  }): Promise<Record<string, unknown>> {
    const recorded = session.dashboard_refund;
    if (!recorded || recorded.amount_in_minor !== amountInMinor) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        'Credo refunds are made in the Credo dashboard. Refund there, then use "Record Credo refund" on the order page.',
      );
    }
    return {
      source: "credo_dashboard",
      reference: recorded.reference,
      amount_in_minor: amountInMinor,
      recorded_by: recorded.recorded_by,
      recorded_at: new Date().toISOString(),
    };
  }

  /**
   * As the base, but the one-time authorization doesn't outlive its refund.
   * Set to null rather than left out: the payment module merges stored data,
   * so a missing key would keep the old value.
   */
  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const { data } = await super.refundPayment(input);
    return { data: { ...data, dashboard_refund: null } };
  }

  protected async parseWebhook(
    payload: ProviderWebhookPayload["payload"],
  ): Promise<NormalizedWebhook> {
    this.assertSignature(payload);

    const body = (payload.data ?? {}) as Record<string, unknown>;
    const data = (body.data ?? body) as Record<string, unknown>;
    if (
      body.event &&
      !["transaction.successful", "transaction.failed"].includes(
        String(body.event),
      )
    ) {
      return { action: "not_supported" };
    }
    const state = normalizeStatus(data.status);

    const amount = data.transAmount ?? data.amount;
    const currency = data.currencyCode ?? data.currency;

    return {
      action: CREDO_STATE_ACTIONS[state],
      sessionId: readSessionId(data),
      amountInMinor: typeof amount === "number" ? amount : undefined,
      currencyCode: typeof currency === "string" ? currency : undefined,
    };
  }

  /**
   * Credo documents both body HMACs and a legacy shared-secret header.
   * Legacy acceptance requires explicit token/business-code configuration;
   * an invalid body HMAC must never fall back to that weaker check.
   */
  private assertSignature(payload: ProviderWebhookPayload["payload"]): void {
    const hmacSignature = payload.headers?.["credo-signature"];
    if (typeof hmacSignature === "string") {
      if (!payload.rawData) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Raw webhook body is required.",
        );
      }
      const expected = createHmac("sha512", this.options_.secretKey)
        .update(payload.rawData)
        .digest("hex");
      const actual = Buffer.from(hmacSignature.toLowerCase());
      const signature = Buffer.from(expected);
      if (
        actual.length !== signature.length ||
        !timingSafeEqual(actual, signature)
      ) {
        throw new MedusaError(
          MedusaError.Types.NOT_ALLOWED,
          "Credo webhook signature did not match.",
        );
      }
      return;
    }

    const { webhookToken, businessCode } = this.options_;

    if (!webhookToken || !businessCode) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "webhookToken and businessCode must be configured before Credo webhooks can be trusted.",
      );
    }

    const headers = (payload.headers ?? {}) as Record<
      string,
      string | string[]
    >;
    const received = String(
      headers["x-credo-signature"] ?? headers["x-signature"] ?? "",
    );

    if (!received) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Missing X-Credo-Signature header.",
      );
    }

    const expected = createHash("sha512")
      .update(`${webhookToken}${businessCode}`)
      .digest("hex");

    const actual = Buffer.from(received.toLowerCase());
    const signature = Buffer.from(expected);
    if (
      actual.length !== signature.length ||
      !timingSafeEqual(actual, signature)
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "X-Credo-Signature did not match.",
      );
    }
  }
}

function readSessionId(data: Record<string, unknown>): string | undefined {
  const metadata = data.metadata as
    | { customFields?: { variable_name?: string; value?: unknown }[] }
    | undefined;

  const field = metadata?.customFields?.find(
    (entry) => entry.variable_name === SESSION_FIELD,
  );

  return typeof field?.value === "string" ? field.value : undefined;
}

export default CredoPaymentProvider;
