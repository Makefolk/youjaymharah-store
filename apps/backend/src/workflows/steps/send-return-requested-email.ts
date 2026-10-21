import type { INotificationModuleService } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { BRANDING_MODULE } from "../../modules/branding";
import type BrandingModuleService from "../../modules/branding/service";
import { EmailTemplates } from "../../modules/resend/emails";
import { emailIdempotency } from "../../modules/resend/idempotency";
import type { ReturnRequestSummary } from "../../modules/resend/emails/return-requested";

export type SendReturnRequestedEmailInput = {
  /** order.return_requested's `return_id`. */
  return_id: string;
};

export type SendReturnRequestedEmailOutput = {
  return_id: string;
  order_id: string | null;
  sent_to: string | null;
};

export const sendReturnRequestedEmailStep = createStep(
  {
    name: "send-return-requested-email",
    // Transient Resend/network failures are retried by the workflow engine.
    // Permanent conditions below use StepResponse.permanentFailure instead.
    maxRetries: 5,
    retryInterval: 15,
  },
  async (input: SendReturnRequestedEmailInput, { container }) => {
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
        "location_id",
        "no_notification",
        "received_at",
        "canceled_at",
        "items.quantity",
        "items.item.product_title",
        "items.item.variant_title",
        "items.reason.label",
      ],
      filters: { id: input.return_id },
    });

    if (!orderReturn) {
      return StepResponse.permanentFailure(
        `send-return-requested-email: return ${input.return_id} could not be retrieved.`,
      );
    }

    // A return created and received in one go (an in-person return) emits
    // return_requested and return_received together; the received email says
    // everything this one would. A return canceled before this ran is moot.
    if (
      orderReturn.received_at ||
      orderReturn.canceled_at ||
      orderReturn.no_notification
    ) {
      logger.info(
        `send-return-requested-email: return ${orderReturn.id} is already received, canceled, or has notifications off; skipping.`,
      );
      return new StepResponse<SendReturnRequestedEmailOutput>({
        return_id: orderReturn.id,
        order_id: orderReturn.order_id,
        sent_to: null,
      });
    }

    const {
      data: [order],
    } = await query.graph({
      entity: "order",
      // Exactly the fields the return-requested template reads.
      fields: [
        "id",
        "display_id",
        "email",
        "no_notification",
        "customer.first_name",
        "customer.email",
        "shipping_address.first_name",
      ],
      filters: { id: orderReturn.order_id },
    });

    if (!order) {
      return StepResponse.permanentFailure(
        `send-return-requested-email: order ${orderReturn.order_id} could not be retrieved.`,
      );
    }

    const recipient = order.email ?? order.customer?.email;

    if (!recipient || order.no_notification) {
      logger.info(
        `send-return-requested-email: order ${order.id} has no email or has notifications off; skipping.`,
      );
      return new StepResponse<SendReturnRequestedEmailOutput>({
        return_id: orderReturn.id,
        order_id: order.id,
        sent_to: null,
      });
    }

    // The return's stock location is where the customer sends the parcel.
    let location: ReturnRequestSummary["location"] = null;

    if (orderReturn.location_id) {
      const {
        data: [stockLocation],
      } = await query.graph({
        entity: "stock_location",
        fields: [
          "id",
          "name",
          "address.address_1",
          "address.address_2",
          "address.city",
          "address.province",
          "address.postal_code",
          "address.country_code",
        ],
        filters: { id: orderReturn.location_id },
      });

      if (stockLocation) {
        const address = stockLocation.address;

        location = {
          name: stockLocation.name,
          address_lines: [
            address?.address_1,
            address?.address_2,
            [address?.city, address?.province].filter(Boolean).join(", "),
            address?.postal_code,
            address?.country_code?.toUpperCase(),
          ].filter((line): line is string => Boolean(line)),
        };
      }
    }

    const summary: ReturnRequestSummary = {
      id: orderReturn.id,
      display_id: orderReturn.display_id,
      items: (orderReturn.items ?? []).map((item) => ({
        title: item?.item?.product_title,
        variant_title: item?.item?.variant_title,
        quantity: Number(item?.quantity ?? 1),
        reason: item?.reason?.label ?? null,
      })),
      location,
    };

    const brand = await brandingModuleService.retrieveSettings();

    // Deliberately not caught: a throw is what schedules the retry.
    await notificationModuleService.createNotifications({
      to: recipient,
      channel: "email",
      resource_type: "order",
      resource_id: order.id,
      template: EmailTemplates.RETURN_REQUESTED,
      ...emailIdempotency(`return-requested:${input.return_id}`),
      data: { order, orderReturn: summary, brand },
    });

    logger.info(
      `send-return-requested-email: return email sent to ${recipient} for order #${order.display_id}.`,
    );

    return new StepResponse<SendReturnRequestedEmailOutput>({
      return_id: orderReturn.id,
      order_id: order.id,
      sent_to: recipient,
    });
  },
);
