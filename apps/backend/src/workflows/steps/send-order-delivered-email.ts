import type { INotificationModuleService } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { BRANDING_MODULE } from "../../modules/branding";
import type BrandingModuleService from "../../modules/branding/service";
import { EmailTemplates } from "../../modules/resend/emails";
import { emailIdempotency } from "../../modules/resend/idempotency";
import type { DeliverySummary } from "../../modules/resend/emails/order-delivered";

export type SendOrderDeliveredEmailInput = {
  /** The fulfillment marked as delivered (delivery.created's `id`). */
  fulfillment_id: string;
};

export type SendOrderDeliveredEmailOutput = {
  fulfillment_id: string;
  order_id: string | null;
  sent_to: string | null;
};

export const sendOrderDeliveredEmailStep = createStep(
  {
    name: "send-order-delivered-email",
    // Transient Resend/network failures are retried by the workflow engine.
    // Permanent conditions below use StepResponse.permanentFailure instead.
    maxRetries: 5,
    retryInterval: 15,
  },
  async (input: SendOrderDeliveredEmailInput, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const notificationModuleService: INotificationModuleService =
      container.resolve(Modules.NOTIFICATION);
    const brandingModuleService: BrandingModuleService =
      container.resolve(BRANDING_MODULE);

    const {
      data: [fulfillment],
    } = await query.graph({
      entity: "fulfillment",
      fields: [
        "id",
        "delivered_at",
        "items.title",
        "items.quantity",
        "order.id",
      ],
      filters: { id: input.fulfillment_id },
    });

    if (!fulfillment?.order?.id) {
      return StepResponse.permanentFailure(
        `send-order-delivered-email: fulfillment ${input.fulfillment_id} or its order could not be retrieved.`,
      );
    }

    const {
      data: [order],
    } = await query.graph({
      entity: "order",
      // Exactly the fields the order-delivered template reads.
      fields: [
        "id",
        "display_id",
        "email",
        "no_notification",
        "customer.first_name",
        "customer.email",
        "shipping_address.first_name",
        "items.product_title",
        "items.quantity",
      ],
      filters: { id: fulfillment.order.id },
    });

    if (!order) {
      return StepResponse.permanentFailure(
        `send-order-delivered-email: order ${fulfillment.order.id} could not be retrieved.`,
      );
    }

    const recipient = order.email ?? order.customer?.email;

    // no_notification is set when an order is created with notifications off
    // (e.g. a draft order staff did not want to email about).
    if (!recipient || order.no_notification) {
      logger.info(
        `send-order-delivered-email: order ${order.id} has no email or has notifications off; skipping.`,
      );
      return new StepResponse<SendOrderDeliveredEmailOutput>({
        fulfillment_id: fulfillment.id,
        order_id: order.id,
        sent_to: null,
      });
    }

    const delivery: DeliverySummary = {
      id: fulfillment.id,
      delivered_at: fulfillment.delivered_at,
      items: (fulfillment.items ?? []).map((item) => ({
        title: item?.title,
        quantity: Number(item?.quantity ?? 1),
      })),
    };

    const brand = await brandingModuleService.retrieveSettings();

    // Deliberately not caught: a throw is what schedules the retry.
    await notificationModuleService.createNotifications({
      to: recipient,
      channel: "email",
      resource_type: "order",
      resource_id: order.id,
      template: EmailTemplates.ORDER_DELIVERED,
      ...emailIdempotency(`order-delivered:${input.fulfillment_id}`),
      data: { order, delivery, brand },
    });

    logger.info(
      `send-order-delivered-email: delivery email sent to ${recipient} for order #${order.display_id}.`,
    );

    return new StepResponse<SendOrderDeliveredEmailOutput>({
      fulfillment_id: fulfillment.id,
      order_id: order.id,
      sent_to: recipient,
    });
  },
);
