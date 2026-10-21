import {
  AbstractPaymentProvider,
  BigNumber,
  MedusaError,
} from "@medusajs/framework/utils";
import type {
  AuthorizePaymentInput,
  AuthorizePaymentOutput,
  CancelPaymentInput,
  CancelPaymentOutput,
  CapturePaymentInput,
  CapturePaymentOutput,
  DeletePaymentInput,
  DeletePaymentOutput,
  GetPaymentStatusInput,
  GetPaymentStatusOutput,
  InitiatePaymentInput,
  InitiatePaymentOutput,
  Logger,
  PaymentSessionStatus,
  ProviderWebhookPayload,
  RefundPaymentInput,
  RefundPaymentOutput,
  RetrievePaymentInput,
  RetrievePaymentOutput,
  UpdatePaymentInput,
  UpdatePaymentOutput,
  WebhookActionResult,
} from "@medusajs/framework/types";

import { fromMinorUnit, toGatewayReference, toMinorUnit } from "./amount";
import type {
  InitializedTransaction,
  InitializeTransactionInput,
  NormalizedTransaction,
  NormalizedWebhook,
  Payer,
  RedirectProviderOptions,
  RedirectSessionData,
} from "./types";

export type RedirectProviderDependencies = {
  logger: Logger;
};

/**
 * Base for hosted-checkout ("redirect") gateways such as Credo and Paystack.
 *
 * The flow these gateways share:
 *
 *   initiatePayment  -> create a transaction, hand the storefront a redirect URL
 *   (customer pays on the gateway's page, then returns to `callbackUrl`)
 *   authorizePayment -> verify the reference server-side; that verify call is
 *                       the source of truth, not the webhook
 *
 * Subclasses supply only the four gateway-specific operations at the bottom.
 */
export abstract class RedirectPaymentProvider<
  TOptions extends RedirectProviderOptions = RedirectProviderOptions,
> extends AbstractPaymentProvider<TOptions> {
  protected readonly logger_: Logger;
  protected readonly options_: TOptions;

  constructor(container: RedirectProviderDependencies, options: TOptions) {
    super(container, options);

    this.logger_ = container.logger;
    this.options_ = options;
  }

  async initiatePayment(
    input: InitiatePaymentInput,
  ): Promise<InitiatePaymentOutput> {
    const sessionId = input.data?.session_id as string | undefined;

    if (!sessionId) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `[${this.getIdentifier()}] No session_id was provided when initiating the payment.`,
      );
    }

    const data = await this.createSession({
      sessionId,
      reference: toGatewayReference(sessionId),
      amount: input.amount,
      currencyCode: input.currency_code,
      context: input.context,
      extra: input.data,
    });

    return {
      id: data.reference,
      status: "pending",
      data: data as unknown as Record<string, unknown>,
    };
  }

  /**
   * Re-initializes the transaction when the cart total changes. The gateways
   * reject a reference that has already been used, so a fresh suffix is added.
   */
  async updatePayment(input: UpdatePaymentInput): Promise<UpdatePaymentOutput> {
    const session = this.getSessionData(input.data);
    const amountInMinor = toMinorUnit(input.amount, input.currency_code);

    if (
      session.amount_in_minor === amountInMinor &&
      session.currency_code.toUpperCase() === input.currency_code.toUpperCase()
    ) {
      return {
        data: session as unknown as Record<string, unknown>,
        status: "pending",
      };
    }

    const data = await this.createSession({
      sessionId: session.session_id,
      reference: toGatewayReference(
        session.session_id,
        Date.now().toString(36),
      ),
      amount: input.amount,
      currencyCode: input.currency_code,
      context: input.context,
      extra: input.data,
    });

    return {
      data: data as unknown as Record<string, unknown>,
      status: "pending",
    };
  }

  async authorizePayment(
    input: AuthorizePaymentInput,
  ): Promise<AuthorizePaymentOutput> {
    return await this.getPaymentStatus(input);
  }

  async getPaymentStatus(
    input: GetPaymentStatusInput,
  ): Promise<GetPaymentStatusOutput> {
    const session = this.getSessionData(input.data);
    const transaction = await this.verifyTransaction(session);

    if (transaction.status === "successful") {
      this.assertVerifiedPayment(session, transaction);
    }

    return {
      status: this.toSessionStatus(transaction.status),
      data: { ...session, verification: transaction.raw },
    };
  }

  /**
   * Both gateways charge the card on the hosted page, so there is no separate
   * capture step — we re-verify and refuse to report success unless the gateway
   * agrees the money moved.
   */
  async capturePayment(
    input: CapturePaymentInput,
  ): Promise<CapturePaymentOutput> {
    const session = this.getSessionData(input.data);
    const transaction = await this.verifyTransaction(session);

    if (transaction.status !== "successful") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `[${this.getIdentifier()}] Cannot capture ${session.reference}: gateway reports "${transaction.status}".`,
      );
    }

    this.assertVerifiedPayment(session, transaction);

    return { data: { ...session, verification: transaction.raw } };
  }

  async refundPayment(input: RefundPaymentInput): Promise<RefundPaymentOutput> {
    const session = this.getSessionData(input.data);
    const raw = await this.refundTransaction({
      session,
      amountInMinor: toMinorUnit(input.amount, session.currency_code),
    });

    return { data: { ...session, refund: raw } };
  }

  async retrievePayment(
    input: RetrievePaymentInput,
  ): Promise<RetrievePaymentOutput> {
    const session = this.getSessionData(input.data);
    const transaction = await this.verifyTransaction(session);

    return { data: transaction.raw };
  }

  /**
   * Neither gateway can void a hosted session — an unpaid one simply expires —
   * so both of these are passthroughs that keep the stored data intact.
   */
  async cancelPayment(input: CancelPaymentInput): Promise<CancelPaymentOutput> {
    return { data: input.data ?? {} };
  }

  async deletePayment(input: DeletePaymentInput): Promise<DeletePaymentOutput> {
    return { data: input.data ?? {} };
  }

  async getWebhookActionAndData(
    payload: ProviderWebhookPayload["payload"],
  ): Promise<WebhookActionResult> {
    let parsed: NormalizedWebhook;

    try {
      parsed = await this.parseWebhook(payload);
    } catch (error) {
      this.logger_.error(
        `[${this.getIdentifier()}] Rejected webhook: ${(error as Error).message}`,
      );
      return { action: "failed" };
    }

    if (!parsed.sessionId) {
      // Not every gateway event carries our metadata (settlement notices, for
      // one). Without a session id there is nothing for Medusa to act on.
      return { action: "not_supported" };
    }

    if (
      !Number.isSafeInteger(parsed.amountInMinor) ||
      (parsed.amountInMinor ?? -1) < 0 ||
      !parsed.currencyCode ||
      !/^[A-Za-z]{3}$/.test(parsed.currencyCode)
    ) {
      return { action: "not_supported" };
    }

    // Medusa processes this through the event bus with `attempts: 3` and a
    // short delay, after the gateway has already been answered. With REDIS_URL
    // set (production), the Redis event bus keeps the event across restarts
    // and retries it. Only local dev, on the in-memory bus, ignores `attempts`
    // and loses an event pending during a restart. Either way the webhook is
    // a second path, not the only one: the customer's return leg re-runs
    // authorizePayment, which verifies with the gateway server-side.
    return {
      action: parsed.action,
      data: {
        session_id: parsed.sessionId,
        amount: new BigNumber(
          fromMinorUnit(parsed.amountInMinor!, parsed.currencyCode),
        ),
      },
    };
  }

  protected async createSession(args: {
    sessionId: string;
    reference: string;
    amount: InitiatePaymentInput["amount"];
    currencyCode: string;
    context?: InitiatePaymentInput["context"];
    extra?: Record<string, unknown>;
  }): Promise<RedirectSessionData> {
    const currencyCode = args.currencyCode.toUpperCase();
    const amountInMinor = toMinorUnit(args.amount, currencyCode);

    let initialized: InitializedTransaction;
    try {
      initialized = await this.initializeTransaction({
        reference: args.reference,
        amountInMinor,
        currencyCode,
        sessionId: args.sessionId,
        context: args.context,
        data: args.extra,
      });
    } catch (error) {
      // The gateway's own text ("Credo POST /transaction/initialize failed
      // (401): ... contact our support team") is for us, not the shopper.
      this.logger_.error(
        `[${this.getIdentifier()}] Could not start a payment for session ${args.sessionId}: ${(error as Error).message}`,
      );
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "We couldn't start this payment just now. Please try again, or choose another way to pay.",
      );
    }

    return {
      reference: initialized.reference,
      gateway_reference: initialized.gatewayReference,
      redirect_url: initialized.redirectUrl,
      session_id: args.sessionId,
      amount_in_minor: amountInMinor,
      currency_code: currencyCode,
      payer: args.extra?.payer as Payer | undefined,
    };
  }

  /**
   * Medusa only puts `context.customer` on the session for logged-in
   * customers (the store route passes the auth actor id), so guest checkouts
   * arrive with no customer at all. The storefront therefore sends the cart's
   * contact details as `data.payer`; the authenticated customer still wins
   * when present. This is only the receipt address and name shown on the
   * gateway's page -- nothing about whether money moved is taken from it.
   */
  protected resolvePayer(input: InitializeTransactionInput): Payer {
    const customer = input.context?.customer;
    const payer = (input.data?.payer ?? {}) as Payer;

    return {
      email: customer?.email || payer.email,
      first_name: customer?.first_name || payer.first_name,
      last_name: customer?.last_name || payer.last_name,
      phone: customer?.phone || payer.phone,
    };
  }

  protected getSessionData(
    data?: Record<string, unknown>,
  ): RedirectSessionData {
    const session = data as RedirectSessionData | undefined;

    if (!session?.reference) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `[${this.getIdentifier()}] The payment session has no gateway reference stored.`,
      );
    }

    return session;
  }

  protected toSessionStatus(
    status: NormalizedTransaction["status"],
  ): PaymentSessionStatus {
    switch (status) {
      case "successful":
        return "captured";
      case "failed":
        return "error";
      case "canceled":
        return "canceled";
      default:
        // The customer has not finished on the hosted page yet. This lets the
        // cart complete into an order with an "awaiting" payment status instead
        // of failing the checkout outright.
        return "pending_authorization";
    }
  }

  protected assertVerifiedPayment(
    session: RedirectSessionData,
    transaction: NormalizedTransaction,
  ): void {
    if (
      !Number.isSafeInteger(session.amount_in_minor) ||
      session.amount_in_minor < 0 ||
      !Number.isSafeInteger(transaction.amountInMinor) ||
      transaction.amountInMinor !== session.amount_in_minor ||
      !transaction.currencyCode ||
      transaction.currencyCode.toUpperCase() !==
        session.currency_code?.toUpperCase() ||
      transaction.reference !== session.reference
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `[${this.getIdentifier()}] Verified payment does not match the expected amount, currency, and reference.`,
      );
    }
  }

  /** Create the transaction and return the hosted page to redirect to. */
  protected abstract initializeTransaction(
    input: InitializeTransactionInput,
  ): Promise<InitializedTransaction>;

  /** Server-side verification. This is what decides whether money moved. */
  protected abstract verifyTransaction(
    session: RedirectSessionData,
  ): Promise<NormalizedTransaction>;

  protected abstract refundTransaction(args: {
    session: RedirectSessionData;
    amountInMinor: number;
  }): Promise<Record<string, unknown>>;

  /** Verify the signature and map the event. Throw to reject the webhook. */
  protected abstract parseWebhook(
    payload: ProviderWebhookPayload["payload"],
  ): Promise<NormalizedWebhook>;
}
