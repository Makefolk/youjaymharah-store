import type { CreateNotificationDTO } from "@medusajs/framework/types";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { BRANDING_MODULE } from "../../modules/branding";
import type BrandingModuleService from "../../modules/branding/service";
import { EmailTemplates } from "../../modules/resend/emails";
import { SUPPORT_EMAIL } from "../../modules/resend/emails/constants";
import { emailIdempotency } from "../../modules/resend/idempotency";
import { STOREFRONT_SETTINGS_MODULE } from "../../modules/storefront-settings";
import type StorefrontSettingsModuleService from "../../modules/storefront-settings/service";
import { completeSupportInfo } from "../../modules/storefront-settings/support-info";

export type ContactMessageInput = {
  name: string;
  email: string;
  topic?: string | null;
  /** As the customer typed it; digits only by the time it gets here. */
  order_number?: string | null;
  message: string;
  /** Unique per submission; persisted, so step retries reuse it. */
  request_key: string;
};

export type PreparedContactMessage = {
  to_support: CreateNotificationDTO;
  to_customer: CreateNotificationDTO;
};

export const prepareContactMessageStep = createStep(
  "prepare-contact-message",
  async (input: ContactMessageInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const brandingService: BrandingModuleService =
      container.resolve(BRANDING_MODULE);
    const settingsService: StorefrontSettingsModuleService = container.resolve(
      STOREFRONT_SETTINGS_MODULE,
    );

    const [brand, settings] = await Promise.all([
      brandingService.retrieveSettings(),
      settingsService.retrieveSettings(),
    ]);
    const email = input.email.trim().toLowerCase();

    // Tells staff whether the order number is really this customer's, so
    // they don't discuss someone else's order with whoever typed it.
    let orderMatched = false;
    if (input.order_number) {
      const { data: orders } = await query.graph({
        entity: "order",
        fields: ["id", "email"],
        filters: { display_id: input.order_number },
      });
      orderMatched = orders.some(
        (order) => order.email?.trim().toLowerCase() === email,
      );
    }

    const shared = {
      name: input.name,
      message: input.message,
      brand,
    };

    return new StepResponse<PreparedContactMessage>({
      to_support: {
        to: brand.support_email || SUPPORT_EMAIL,
        channel: "email",
        template: EmailTemplates.CONTACT_MESSAGE,
        ...emailIdempotency(`contact-message:${input.request_key}`),
        data: {
          ...shared,
          email,
          topic: input.topic ?? null,
          order_number: input.order_number ?? null,
          order_matched: orderMatched,
          // Replying from the support inbox answers the customer.
          reply_to: email,
        },
      },
      to_customer: {
        to: email,
        channel: "email",
        template: EmailTemplates.CONTACT_RECEIVED,
        ...emailIdempotency(`contact-received:${input.request_key}`),
        data: {
          ...shared,
          response_time: completeSupportInfo(settings.support_info)
            .response_time,
        },
      },
    });
  },
);
