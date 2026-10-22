import { createHmac, timingSafeEqual } from "node:crypto";

import { MedusaError } from "@medusajs/framework/utils";
import type { ProviderWebhookPayload } from "@medusajs/framework/types";

import { RedirectPaymentProvider } from "../shared/redirect-payment-provider";
import type { RedirectProviderDependencies } from "../shared/redirect-payment-provider";
import type {
  InitializedTransaction,
  InitializeTransactionInput,
  NormalizedTransaction,
  NormalizedWebhook,
  RedirectSessionData,
} from "../shared/types";
import {
  PaystackClient,
  normalizeStatus,
  type PaystackOptions,
} from "./client";

class PaystackPaymentProvider extends RedirectPaymentProvider<PaystackOptions> {
  static identifier = "paystack";

  private readonly client: PaystackClient;

  constructor(
    container: RedirectProviderDependencies,
    options: PaystackOptions,
  ) {
    super(container, options);

    this.client = new PaystackClient(options);
  }

  static validateOptions(options: Record<string, unknown>): void {
    if (!options.secretKey) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        'Paystack payment provider requires the "secretKey" option.',
      );
    }
  }

  protected async initializeTransaction(
    input: InitializeTransactionInput,
  ): Promise<InitializedTransaction> {
    const email = this.resolvePayer(input).email;

    if (!email) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Paystack requires a customer email to initialize a transaction.",
      );
    }

    const result = await this.client.initialize({
      email,
      amount: input.amountInMinor,
      currency: input.currencyCode,
      reference: input.reference,
      callback_url: this.options_.callbackUrl,
      channels: this.options_.channels,
      // Paystack echoes metadata back on both verify and webhook payloads.
      metadata: { session_id: input.sessionId },
    });

    return {
      reference: result.reference,
      redirectUrl: result.redirectUrl,
    };
  }

  protected async verifyTransaction(
    session: RedirectSessionData,
  ): Promise<NormalizedTransaction> {
    const result = await this.client.verify(session.reference);

    return {
      status: result.state,
      reference:
        typeof result.raw.reference === "string"
          ? result.raw.reference
          : undefined,
      amountInMinor: result.amountInMinor,
      currencyCode: result.currencyCode,
      raw: result.raw,
    };
  }

  protected async refundTransaction(args: {
    session: RedirectSessionData;
    amountInMinor: number;
  }): Promise<Record<string, unknown>> {
    const recorded = args.session.dashboard_refund;
    if (
      !recorded ||
      !/^[1-9]\d*$/.test(recorded.reference) ||
      recorded.amount_in_minor !== args.amountInMinor
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        'Refund in the Paystack dashboard, then use "Record refund" on the order page with the completed refund ID.',
      );
    }
    const refund = await this.client.retrieveRefund(recorded.reference);
    const transaction = await this.client.verify(args.session.reference);
    const refundTransaction =
      typeof refund.transaction === "object" && refund.transaction !== null
        ? (refund.transaction as Record<string, unknown>).id
        : refund.transaction;
    if (
      refund.status !== "processed" ||
      String(refund.id) !== recorded.reference ||
      refund.amount !== args.amountInMinor ||
      refund.currency !== args.session.currency_code.toUpperCase() ||
      !transaction.raw.id ||
      String(refundTransaction) !== String(transaction.raw.id)
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Paystack has not confirmed a completed refund for this payment, amount and currency.",
      );
    }
    return {
      source: "paystack_dashboard",
      id: refund.id,
      reference: recorded.reference,
      status: "processed",
      amount_in_minor: args.amountInMinor,
      recorded_by: recorded.recorded_by,
    };
  }

  protected async parseWebhook(
    payload: ProviderWebhookPayload["payload"],
  ): Promise<NormalizedWebhook> {
    this.assertSignature(payload);

    const body = (payload.data ?? {}) as Record<string, unknown>;
    const event = String(body.event ?? "");
    const data = (body.data ?? {}) as Record<string, unknown>;
    const metadata = (data.metadata ?? {}) as Record<string, unknown>;

    const action =
      event === "charge.success" &&
      normalizeStatus(data.status) === "successful"
        ? "captured"
        : event.startsWith("charge.")
          ? "failed"
          : "not_supported";

    return {
      action,
      sessionId:
        typeof metadata.session_id === "string"
          ? metadata.session_id
          : undefined,
      amountInMinor: typeof data.amount === "number" ? data.amount : undefined,
      currencyCode:
        typeof data.currency === "string" ? data.currency : undefined,
    };
  }

  /** HMAC-SHA512 of the raw body, keyed with the secret key. */
  private assertSignature(payload: ProviderWebhookPayload["payload"]): void {
    const headers = (payload.headers ?? {}) as Record<
      string,
      string | string[]
    >;
    const received = String(headers["x-paystack-signature"] ?? "");

    if (!received) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Missing x-paystack-signature header.",
      );
    }

    const raw = payload.rawData;

    if (!raw) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Raw request body was not preserved; cannot verify signature.",
      );
    }

    const expected = createHmac("sha512", this.options_.secretKey)
      .update(Buffer.isBuffer(raw) ? raw : Buffer.from(raw as string))
      .digest("hex");

    const a = Buffer.from(received);
    const b = Buffer.from(expected);

    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "x-paystack-signature did not match.",
      );
    }
  }
}

export default PaystackPaymentProvider;
