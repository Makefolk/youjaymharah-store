import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { createReturnAccessToken } from "../../lib/return-access";
import { BRANDING_MODULE } from "../../modules/branding";
import type BrandingModuleService from "../../modules/branding/service";
import { EmailTemplates } from "../../modules/resend/emails";
import { createOrderAccessKey } from "../../lib/order-access";
import { STOREFRONT_URL } from "../../modules/resend/emails/constants";
import { emailIdempotency } from "../../modules/resend/idempotency";
import type { PreparedEmail } from "./send-prepared-email";

export type SendReturnAccessEmailInput = {
  order_id: string;
  /** Unique per request; persisted, so step retries reuse it. */
  request_key: string;
};

export type SendReturnAccessEmailOutput = { sent_to: string };

/**
 * Builds the return link for the order's own email address. The address is
 * never taken from the request, so the link can only reach the order's inbox.
 */
export const prepareReturnAccessEmailStep = createStep(
  "prepare-return-access-email",
  async (input: SendReturnAccessEmailInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const brandingService: BrandingModuleService =
      container.resolve(BRANDING_MODULE);

    const {
      data: [order],
    } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "email"],
      filters: { id: input.order_id },
    });
    if (!order) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found.");
    }
    if (!order.email) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This order has no email address to send a return link to.",
      );
    }

    const token = createReturnAccessToken(order.id, order.email);
    // The return page shows the order too, so the link opens that as well.
    const url = `${STOREFRONT_URL.replace(/\/$/, "")}/orders/${encodeURIComponent(order.id)}/return?access=${encodeURIComponent(token)}&key=${encodeURIComponent(createOrderAccessKey(order.id))}`;
    const brand = await brandingService.retrieveSettings();

    return new StepResponse<PreparedEmail<SendReturnAccessEmailOutput>>({
      notification: {
        to: order.email,
        channel: "email",
        resource_type: "order",
        resource_id: order.id,
        template: EmailTemplates.RETURN_ACCESS,
        ...emailIdempotency(`return-access:${order.id}:${input.request_key}`),
        data: {
          url,
          order_number: order.display_id,
          order: { display_id: order.display_id },
          brand,
        },
      },
      result: { sent_to: order.email },
    });
  },
);
