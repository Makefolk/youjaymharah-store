import type { INotificationModuleService } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { BRANDING_MODULE } from "../../modules/branding";
import type BrandingModuleService from "../../modules/branding/service";
import { EmailTemplates } from "../../modules/resend/emails";
import { emailIdempotency } from "../../modules/resend/idempotency";
import type { ReturnReceiptSummary } from "../../modules/resend/emails/return-received";

export type SendReturnReceivedEmailInput = {
  /** order.return_received's `return_id`. */
  return_id: string;
};

export type SendReturnReceivedEmailOutput = {
  return_id: string;
  order_id: string | null;
  sent_to: string | null;
};

export const sendReturnReceivedEmailStep = createStep(
  {
    name: "send-return-received-email",
    // Transient Resend/network failures are retried by the workflow engine.
    // Permanent conditions below use StepResponse.permanentFailure instead.
    maxRetries: 5,
    retryInterval: 15,
  },
  async (input: SendReturnReceivedEmailInput, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const notificationModuleService: INotificationModuleService =
      container.resolve(Modules.NOTIFICATION);
    const brandingModuleService: BrandingModuleService =
      container.resolve(BRANDING_MODULE);

    const {
      data: [orderReturn],
    } = await query.graph({
      entity: "return",
      fields: [
        "id",
        "display_id",
        "order_id",
        "no_notification",
        "refund_amount",
        // Which of these is set tells the template not to promise a refund.
        "exchange.id",
        "claim.id",
        "items.quantity",
        "items.received_quantity",
        "items.damaged_quantity",
        "items.item.product_title",
        "items.item.variant_title",
      ],
      filters: { id: input.return_id },
    });

    if (!orderReturn) {
      return StepResponse.permanentFailure(
        `send-return-received-email: return ${input.return_id} could not be retrieved.`,
      );
    }

    if (orderReturn.no_notification) {
      logger.info(
        `send-return-received-email: return ${orderReturn.id} has notifications off; skipping.`,
      );
      return new StepResponse<SendReturnReceivedEmailOutput>({
        return_id: orderReturn.id,
        order_id: orderReturn.order_id,
        sent_to: null,
      });
    }

    const {
      data: [order],
    } = await query.graph({
      entity: "order",
      // Exactly the fields the return-received template reads.
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
      filters: { id: orderReturn.order_id },
    });

    if (!order) {
      return StepResponse.permanentFailure(
        `send-return-received-email: order ${orderReturn.order_id} could not be retrieved.`,
      );
    }

    const recipient = order.email ?? order.customer?.email;

    if (!recipient || order.no_notification) {
      logger.info(
        `send-return-received-email: order ${order.id} has no email or has notifications off; skipping.`,
      );
      return new StepResponse<SendReturnReceivedEmailOutput>({
        return_id: orderReturn.id,
        order_id: order.id,
        sent_to: null,
      });
    }

    const items = (orderReturn.items ?? []).filter(Boolean).map((item) => ({
      title: item!.item?.product_title,
      variant_title: item!.item?.variant_title,
      received_quantity: Number(item!.received_quantity ?? 0),
      damaged_quantity: Number(item!.damaged_quantity ?? 0),
    }));
    // A partial receipt lists only what actually arrived.
    const arrived = items.filter(
      (item) => item.received_quantity + item.damaged_quantity > 0,
    );

    const summary: ReturnReceiptSummary = {
      id: orderReturn.id,
      display_id: orderReturn.display_id,
      items: arrived.length ? arrived : items,
      refund_amount:
        orderReturn.refund_amount == null
          ? null
          : Number(orderReturn.refund_amount),
      part_of: orderReturn.exchange?.id
        ? "exchange"
        : orderReturn.claim?.id
          ? "claim"
          : null,
    };

    const brand = await brandingModuleService.retrieveSettings();

    // Deliberately not caught: a throw is what schedules the retry.
    await notificationModuleService.createNotifications({
      to: recipient,
      channel: "email",
      resource_type: "order",
      resource_id: order.id,
      template: EmailTemplates.RETURN_RECEIVED,
      ...emailIdempotency(`return-received:${input.return_id}`),
      data: { order, orderReturn: summary, brand },
    });

    logger.info(
      `send-return-received-email: return receipt sent to ${recipient} for order #${order.display_id}.`,
    );

    return new StepResponse<SendReturnReceivedEmailOutput>({
      return_id: orderReturn.id,
      order_id: order.id,
      sent_to: recipient,
    });
  },
);
