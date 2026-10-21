import type { INotificationModuleService } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { BRANDING_MODULE } from "../../modules/branding";
import type BrandingModuleService from "../../modules/branding/service";
import { EmailTemplates } from "../../modules/resend/emails";
import { emailIdempotency } from "../../modules/resend/idempotency";
import type { ExchangeSummary } from "../../modules/resend/emails/exchange-created";
import { resolveReturnDestination } from "../utils/return-destination";

export type SendExchangeCreatedEmailInput = {
  /** order.exchange_created's `exchange_id`. */
  exchange_id: string;
};

export type SendExchangeCreatedEmailOutput = {
  exchange_id: string;
  order_id: string | null;
  sent_to: string | null;
};

export const sendExchangeCreatedEmailStep = createStep(
  {
    name: "send-exchange-created-email",
    // Transient Resend/network failures are retried by the workflow engine.
    // Permanent conditions below use StepResponse.permanentFailure instead.
    maxRetries: 5,
    retryInterval: 15,
  },
  async (input: SendExchangeCreatedEmailInput, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const notificationModuleService: INotificationModuleService =
      container.resolve(Modules.NOTIFICATION);
    const brandingModuleService: BrandingModuleService =
      container.resolve(BRANDING_MODULE);

    const {
      data: [exchange],
    } = await query.graph({
      entity: "order_exchange",
      fields: [
        "id",
        "display_id",
        "order_id",
        "no_notification",
        "canceled_at",
        "additional_items.quantity",
        "additional_items.item.product_title",
        "additional_items.item.variant_title",
        "return.location_id",
        "return.items.quantity",
        "return.items.item.product_title",
        "return.items.item.variant_title",
      ],
      filters: { id: input.exchange_id },
    });

    if (!exchange) {
      return StepResponse.permanentFailure(
        `send-exchange-created-email: exchange ${input.exchange_id} could not be retrieved.`,
      );
    }

    if (exchange.canceled_at || exchange.no_notification) {
      logger.info(
        `send-exchange-created-email: exchange ${exchange.id} is canceled or has notifications off; skipping.`,
      );
      return new StepResponse<SendExchangeCreatedEmailOutput>({
        exchange_id: exchange.id,
        order_id: exchange.order_id,
        sent_to: null,
      });
    }

    const {
      data: [order],
    } = await query.graph({
      entity: "order",
      // Exactly the fields the exchange-created template reads.
      fields: [
        "id",
        "display_id",
        "email",
        "no_notification",
        "currency_code",
        "customer.first_name",
        "customer.email",
        "shipping_address.first_name",
        "summary.pending_difference",
      ],
      filters: { id: exchange.order_id },
    });

    if (!order) {
      return StepResponse.permanentFailure(
        `send-exchange-created-email: order ${exchange.order_id} could not be retrieved.`,
      );
    }

    const recipient = order.email ?? order.customer?.email;

    if (!recipient || order.no_notification) {
      logger.info(
        `send-exchange-created-email: order ${order.id} has no email or has notifications off; skipping.`,
      );
      return new StepResponse<SendExchangeCreatedEmailOutput>({
        exchange_id: exchange.id,
        order_id: order.id,
        sent_to: null,
      });
    }

    const returnItems = (exchange.return?.items ?? []).map((item) => ({
      title: item?.item?.product_title,
      variant_title: item?.item?.variant_title,
      quantity: Number(item?.quantity ?? 1),
    }));

    const summary: ExchangeSummary = {
      id: exchange.id,
      display_id: exchange.display_id,
      new_items: (exchange.additional_items ?? []).map((item) => ({
        title: item?.item?.product_title,
        variant_title: item?.item?.variant_title,
        quantity: Number(item?.quantity ?? 1),
      })),
      return_items: returnItems,
      // Only looked up when something is coming back.
      location: returnItems.length
        ? await resolveReturnDestination(
            container,
            exchange.return?.location_id,
          )
        : null,
      pending_difference: Number(order.summary?.pending_difference ?? 0),
    };

    const brand = await brandingModuleService.retrieveSettings();

    // Deliberately not caught: a throw is what schedules the retry.
    await notificationModuleService.createNotifications({
      to: recipient,
      channel: "email",
      resource_type: "order",
      resource_id: order.id,
      template: EmailTemplates.EXCHANGE_CREATED,
      ...emailIdempotency(`exchange-created:${input.exchange_id}`),
      data: { order, exchange: summary, brand },
    });

    logger.info(
      `send-exchange-created-email: exchange email sent to ${recipient} for order #${order.display_id}.`,
    );

    return new StepResponse<SendExchangeCreatedEmailOutput>({
      exchange_id: exchange.id,
      order_id: order.id,
      sent_to: recipient,
    });
  },
);
