import type { INotificationModuleService } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { BRANDING_MODULE } from "../../modules/branding";
import type BrandingModuleService from "../../modules/branding/service";
import { EmailTemplates } from "../../modules/resend/emails";
import { emailIdempotency } from "../../modules/resend/idempotency";

export type SendOrderCanceledEmailInput = { id: string };

export type SendOrderCanceledEmailOutput = {
  order_id: string;
  sent_to: string | null;
};

export const sendOrderCanceledEmailStep = createStep(
  {
    name: "send-order-canceled-email",
    // Transient Resend/network failures are retried by the workflow engine.
    // Permanent conditions below use StepResponse.permanentFailure instead.
    maxRetries: 5,
    retryInterval: 15,
  },
  async (input: SendOrderCanceledEmailInput, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const notificationModuleService: INotificationModuleService =
      container.resolve(Modules.NOTIFICATION);
    const brandingModuleService: BrandingModuleService =
      container.resolve(BRANDING_MODULE);

    const {
      data: [order],
    } = await query.graph({
      entity: "order",
      // Exactly the fields the order-canceled template reads.
      fields: [
        "id",
        "display_id",
        "email",
        "no_notification",
        "currency_code",
        "total",
        "customer.first_name",
        "customer.email",
        "shipping_address.first_name",
        "items.id",
        "items.product_title",
        "items.variant_title",
        "items.total",
      ],
      filters: { id: input.id },
    });

    if (!order) {
      return StepResponse.permanentFailure(
        `send-order-canceled-email: order ${input.id} could not be retrieved.`,
      );
    }

    const recipient = order.email ?? order.customer?.email;

    // no_notification is set when an order is created with notifications off
    // (e.g. a draft order staff did not want to email about).
    if (!recipient || order.no_notification) {
      logger.info(
        `send-order-canceled-email: order ${order.id} has no email or has notifications off; skipping.`,
      );
      return new StepResponse<SendOrderCanceledEmailOutput>({
        order_id: order.id,
        sent_to: null,
      });
    }

    const brand = await brandingModuleService.retrieveSettings();

    // Deliberately not caught: a throw is what schedules the retry.
    await notificationModuleService.createNotifications({
      to: recipient,
      channel: "email",
      resource_type: "order",
      resource_id: order.id,
      template: EmailTemplates.ORDER_CANCELED,
      ...emailIdempotency(`order-canceled:${input.id}`),
      data: { order, brand },
    });

    logger.info(
      `send-order-canceled-email: cancellation email sent to ${recipient} for order #${order.display_id}.`,
    );

    return new StepResponse<SendOrderCanceledEmailOutput>({
      order_id: order.id,
      sent_to: recipient,
    });
  },
);
