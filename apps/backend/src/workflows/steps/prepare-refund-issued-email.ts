import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { BRANDING_MODULE } from "../../modules/branding";
import type BrandingModuleService from "../../modules/branding/service";
import { EmailTemplates } from "../../modules/resend/emails";
import { emailIdempotency } from "../../modules/resend/idempotency";
import type { PreparedEmail } from "./send-prepared-email";
import type { RefundSummary } from "../../modules/resend/emails/refund-issued";

export type SendRefundIssuedEmailInput = {
  refund_id: string;
};

export type SendRefundIssuedEmailOutput = {
  payment_id: string;
  refund_id: string | null;
  order_id: string | null;
  sent_to: string | null;
};

export const prepareRefundIssuedEmailStep = createStep(
  {
    name: "prepare-refund-issued-email",
    maxRetries: 5,
    retryInterval: 15,
  },
  async (input: SendRefundIssuedEmailInput, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const brandingModuleService: BrandingModuleService =
      container.resolve(BRANDING_MODULE);

    const {
      data: [refund],
    } = await query.graph({
      entity: "refund",
      fields: [
        "id",
        "amount",
        // The label only: a refund's `note` is written for staff, not customers.
        "refund_reason.label",
        "payment.id",
        "payment.currency_code",
        "payment.payment_collection.order.id",
      ],
      filters: { id: input.refund_id },
    });

    if (!refund?.payment) {
      return StepResponse.permanentFailure(
        `send-refund-issued-email: refund ${input.refund_id} or its payment could not be retrieved.`,
      );
    }

    const payment = refund.payment;
    const orderId = payment.payment_collection?.order?.id;

    if (!orderId) {
      logger.info(
        `send-refund-issued-email: payment ${payment.id} has no order; skipping.`,
      );
      return new StepResponse<PreparedEmail<SendRefundIssuedEmailOutput>>({
        notification: null,
        result: {
          payment_id: payment.id,
          refund_id: refund.id,
          order_id: orderId ?? null,
          sent_to: null,
        },
      });
    }

    const {
      data: [order],
    } = await query.graph({
      entity: "order",
      // Exactly the fields the refund-issued template reads.
      fields: [
        "id",
        "display_id",
        "email",
        "no_notification",
        "currency_code",
        "customer.first_name",
        "customer.email",
        "shipping_address.first_name",
      ],
      filters: { id: orderId },
    });

    if (!order) {
      return StepResponse.permanentFailure(
        `send-refund-issued-email: order ${orderId} could not be retrieved.`,
      );
    }

    const recipient = order.email ?? order.customer?.email;

    if (!recipient || order.no_notification) {
      logger.info(
        `send-refund-issued-email: order ${order.id} has no email or has notifications off; skipping.`,
      );
      return new StepResponse<PreparedEmail<SendRefundIssuedEmailOutput>>({
        notification: null,
        result: {
          payment_id: payment.id,
          refund_id: refund.id,
          order_id: order.id,
          sent_to: null,
        },
      });
    }

    const summary: RefundSummary = {
      id: refund.id,
      amount: Number(refund.amount),
      currency_code: payment.currency_code,
      reason: refund.refund_reason?.label ?? null,
    };

    const brand = await brandingModuleService.retrieveSettings();

    return new StepResponse<PreparedEmail<SendRefundIssuedEmailOutput>>({
      notification: {
        to: recipient,
        channel: "email",
        resource_type: "order",
        resource_id: order.id,
        template: EmailTemplates.REFUND_ISSUED,
        ...emailIdempotency(JSON.stringify(["refund-issued", refund.id])),
        data: { order, refund: summary, brand },
      },
      result: {
        payment_id: payment.id,
        refund_id: refund.id,
        order_id: order.id,
        sent_to: recipient,
      },
    });
  },
);
