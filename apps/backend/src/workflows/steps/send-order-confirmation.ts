import type { INotificationModuleService } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { BRANDING_MODULE } from "../../modules/branding";
import type BrandingModuleService from "../../modules/branding/service";
import { EmailTemplates } from "../../modules/resend/emails";
import { emailIdempotency } from "../../modules/resend/idempotency";

export type SendOrderConfirmationInput = {
  id: string;
  /**
   * Set when staff resend the confirmation. Each resend needs its own
   * delivery identity: reusing the original one returns the earlier receipt
   * (or the blocked review state) instead of sending.
   */
  resend_key?: string;
};

export type SendOrderConfirmationOutput = {
  order_id: string;
  display_id: string | null;
  sent_to: string | null;
};

export const sendOrderConfirmationStep = createStep(
  {
    name: "send-order-confirmation-email",
    // Transient Resend/network failures are retried by the workflow engine
    // (in-process with the default engine; durably, surviving restarts, when
    // the Redis engine is configured). Permanent conditions below use
    // StepResponse.permanentFailure so they are not retried.
    maxRetries: 5,
    retryInterval: 15,
  },
  async (input: SendOrderConfirmationInput, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const notificationModuleService: INotificationModuleService =
      container.resolve(Modules.NOTIFICATION);
    const brandingModuleService: BrandingModuleService =
      container.resolve(BRANDING_MODULE);

    const { data: orders } = await query.graph({
      entity: "order",
      // These are exactly the fields the order-placed template reads. Adding a
      // field to the template means adding it here, or it renders as undefined.
      fields: [
        "id",
        "display_id",
        "email",
        "currency_code",
        "total",
        "item_subtotal",
        "discount_subtotal",
        "tax_total",
        "customer.*",
        "shipping_address.*",
        "items.*",
        // Computed totals are not part of `items.*` / `shipping_methods.*`;
        // they have to be requested by name.
        "items.subtotal",
        "shipping_methods.*",
        "shipping_methods.subtotal",
      ],
      filters: { id: input.id },
    });

    const order = orders[0];

    if (!order) {
      // An order that cannot be read is not coming back; retrying only burns
      // attempts and delays the workflow's recorded failure.
      return StepResponse.permanentFailure(
        `send-order-confirmation: order ${input.id} could not be retrieved.`,
      );
    }

    const recipient = order.email ?? order.customer?.email;

    if (!recipient) {
      logger.warn(
        `send-order-confirmation: order ${order.id} has no email address; skipping confirmation.`,
      );
      return new StepResponse<SendOrderConfirmationOutput>({
        order_id: order.id,
        display_id: order.display_id,
        sent_to: null,
      });
    }

    const brand = await brandingModuleService.retrieveSettings();

    // Deliberately not caught: a throw is what schedules the retry. A missing
    // confirmation email must never look like a failed order, so the subscriber
    // runs this workflow fire-and-forget and logs the final outcome.
    await notificationModuleService.createNotifications({
      to: recipient,
      channel: "email",
      resource_type: "order",
      resource_id: order.id,
      template: EmailTemplates.ORDER_PLACED,
      ...emailIdempotency(
        input.resend_key
          ? `order-placed:${input.id}:resend:${input.resend_key}`
          : `order-placed:${input.id}`,
      ),
      data: { order, brand },
    });

    logger.info(
      `send-order-confirmation: confirmation sent to ${recipient} for order #${order.display_id}.`,
    );

    return new StepResponse<SendOrderConfirmationOutput>({
      order_id: order.id,
      display_id: order.display_id,
      sent_to: recipient,
    });
  },
);
