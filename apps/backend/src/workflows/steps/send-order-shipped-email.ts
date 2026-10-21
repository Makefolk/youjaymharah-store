import type { INotificationModuleService } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { BRANDING_MODULE } from "../../modules/branding";
import type BrandingModuleService from "../../modules/branding/service";
import { EmailTemplates } from "../../modules/resend/emails";
import { emailIdempotency } from "../../modules/resend/idempotency";
import type { ShipmentSummary } from "../../modules/resend/emails/order-shipped";

export type SendOrderShippedEmailInput = {
  /** The fulfillment the shipment was created on (shipment.created's `id`). */
  fulfillment_id: string;
  /**
   * Set when staff resend the email. Each resend needs its own delivery
   * identity: reusing the original one returns the earlier receipt instead
   * of sending.
   */
  resend_key?: string;
};

export type SendOrderShippedEmailOutput = {
  fulfillment_id: string;
  order_id: string | null;
  sent_to: string | null;
};

export const sendOrderShippedEmailStep = createStep(
  {
    name: "send-order-shipped-email",
    // Transient Resend/network failures are retried by the workflow engine.
    // Permanent conditions below use StepResponse.permanentFailure instead.
    maxRetries: 5,
    retryInterval: 15,
  },
  async (input: SendOrderShippedEmailInput, { container }) => {
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
        "labels.tracking_number",
        "labels.tracking_url",
        "items.title",
        "items.quantity",
        "order.id",
      ],
      filters: { id: input.fulfillment_id },
    });

    if (!fulfillment?.order?.id) {
      return StepResponse.permanentFailure(
        `send-order-shipped-email: fulfillment ${input.fulfillment_id} or its order could not be retrieved.`,
      );
    }

    const {
      data: [order],
    } = await query.graph({
      entity: "order",
      // Exactly the fields the order-shipped template reads.
      fields: [
        "id",
        "display_id",
        "email",
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
        `send-order-shipped-email: order ${fulfillment.order.id} could not be retrieved.`,
      );
    }

    const recipient = order.email ?? order.customer?.email;

    if (!recipient) {
      logger.warn(
        `send-order-shipped-email: order ${order.id} has no email address; skipping.`,
      );
      return new StepResponse<SendOrderShippedEmailOutput>({
        fulfillment_id: fulfillment.id,
        order_id: order.id,
        sent_to: null,
      });
    }

    const labels = (fulfillment.labels ?? []).filter(Boolean);
    const shipment: ShipmentSummary = {
      id: fulfillment.id,
      tracking_numbers: labels
        .map((label) => label!.tracking_number)
        .filter(Boolean),
      tracking_links: labels
        .filter((label) => label!.tracking_url)
        .map((label) => ({
          url: label!.tracking_url,
          tracking_number: label!.tracking_number,
        })),
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
      template: EmailTemplates.ORDER_SHIPPED,
      ...emailIdempotency(
        input.resend_key
          ? `order-shipped:${input.fulfillment_id}:resend:${input.resend_key}`
          : `order-shipped:${input.fulfillment_id}`,
      ),
      data: { order, shipment, brand },
    });

    logger.info(
      `send-order-shipped-email: shipping email sent to ${recipient} for order #${order.display_id}.`,
    );

    return new StepResponse<SendOrderShippedEmailOutput>({
      fulfillment_id: fulfillment.id,
      order_id: order.id,
      sent_to: recipient,
    });
  },
);
