import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { BRANDING_MODULE } from "../../modules/branding";
import type BrandingModuleService from "../../modules/branding/service";
import { EmailTemplates } from "../../modules/resend/emails";
import { emailIdempotency } from "../../modules/resend/idempotency";
import type { PreparedEmail } from "./send-prepared-email";
import type { OrderUpdateSummary } from "../../modules/resend/emails/order-updated";

export type SendOrderUpdatedEmailInput = {
  /** order-edit.confirmed's `order_id`. */
  order_id: string;
  action_ids: string[];
};

export type SendOrderUpdatedEmailOutput = {
  order_id: string;
  sent_to: string | null;
};

export const prepareOrderUpdatedEmailStep = createStep(
  {
    name: "prepare-order-updated-email",
    maxRetries: 5,
    retryInterval: 15,
  },
  async (input: SendOrderUpdatedEmailInput, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const brandingModuleService: BrandingModuleService =
      container.resolve(BRANDING_MODULE);

    if (
      !input.action_ids?.length ||
      input.action_ids.some((id) => typeof id !== "string" || !id)
    ) {
      return StepResponse.permanentFailure(
        "send-order-updated-email: missing stable edit action IDs.",
      );
    }

    const {
      data: [order],
    } = await query.graph({
      entity: "order",
      // Exactly the fields the order-updated template reads. The edit is
      // already applied when this runs, so these are the post-edit values.
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
        "items.product_title",
        "items.variant_title",
        "items.quantity",
        "summary.pending_difference",
        "summary.current_order_total",
      ],
      filters: { id: input.order_id },
    });

    if (!order) {
      return StepResponse.permanentFailure(
        `send-order-updated-email: order ${input.order_id} could not be retrieved.`,
      );
    }

    const recipient = order.email ?? order.customer?.email;

    if (!recipient || order.no_notification) {
      logger.info(
        `send-order-updated-email: order ${order.id} has no email or has notifications off; skipping.`,
      );
      return new StepResponse<PreparedEmail<SendOrderUpdatedEmailOutput>>({
        notification: null,
        result: {
          order_id: order.id,
          sent_to: null,
        },
      });
    }

    const update: OrderUpdateSummary = {
      items: (order.items ?? [])
        .map((item) => ({
          title: item?.product_title,
          variant_title: item?.variant_title,
          quantity: Number(item?.quantity ?? 0),
        }))
        // A removed item can remain on the order at quantity zero.
        .filter((item) => item.quantity > 0),
      total: Number(order.summary?.current_order_total ?? order.total ?? 0),
      pending_difference: Number(order.summary?.pending_difference ?? 0),
    };

    const brand = await brandingModuleService.retrieveSettings();

    return new StepResponse<PreparedEmail<SendOrderUpdatedEmailOutput>>({
      notification: {
        to: recipient,
        channel: "email",
        resource_type: "order",
        resource_id: order.id,
        template: EmailTemplates.ORDER_UPDATED,
        ...emailIdempotency(
          JSON.stringify([
            "order-updated",
            order.id,
            [...new Set(input.action_ids)].sort(),
          ]),
        ),
        data: { order, update, brand },
      },
      result: {
        order_id: order.id,
        sent_to: recipient,
      },
    });
  },
);
