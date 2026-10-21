import type { ReactNode } from "react";

import { cartReminderCopy, cartReminderEmail } from "./cart-reminder";
import { claimCreatedEmail } from "./claim-created";
import { contactMessageEmail, contactReceivedEmail } from "./contact-message";
import { STORE_NAME } from "./constants";
import { emailVerificationEmail } from "./email-verification";
import { exchangeCreatedEmail } from "./exchange-created";
import { inviteUserEmail } from "./invite-user";
import { newsletterConfirmEmail } from "./newsletter-confirm";
import { newsletterWelcomeEmail } from "./newsletter-welcome";
import { orderCanceledEmail } from "./order-canceled";
import { orderDeliveredEmail } from "./order-delivered";
import { orderPlacedEmail } from "./order-placed";
import { orderShippedEmail } from "./order-shipped";
import { orderUpdatedEmail } from "./order-updated";
import { passwordResetEmail } from "./password-reset";
import { productAvailableEmail } from "./product-available";
import { refundIssuedEmail } from "./refund-issued";
import { returnAccessEmail } from "./return-access";
import { returnReceivedEmail } from "./return-received";
import { returnRequestedEmail } from "./return-requested";

/**
 * Template identifiers. These are the values a subscriber passes as
 * `template` when creating a notification, so they are part of the contract
 * between subscribers and this provider -- renaming one breaks live sends.
 */
export const EmailTemplates = {
  ORDER_PLACED: "order-placed",
  ORDER_UPDATED: "order-updated",
  ORDER_SHIPPED: "order-shipped",
  ORDER_DELIVERED: "order-delivered",
  ORDER_CANCELED: "order-canceled",
  REFUND_ISSUED: "refund-issued",
  RETURN_REQUESTED: "return-requested",
  RETURN_ACCESS: "return-access",
  RETURN_RECEIVED: "return-received",
  EXCHANGE_CREATED: "exchange-created",
  CLAIM_CREATED: "claim-created",
  PASSWORD_RESET: "password-reset",
  EMAIL_VERIFICATION: "email-verification",
  INVITE_USER: "invite-user",
  NEWSLETTER_CONFIRM: "newsletter-confirm",
  NEWSLETTER_WELCOME: "newsletter-welcome",
  PRODUCT_BACK_IN_STOCK: "product-back-in-stock",
  PRODUCT_LAUNCHED: "product-launched",
  CART_REMINDER: "cart-reminder",
  CONTACT_MESSAGE: "contact-message",
  CONTACT_RECEIVED: "contact-received",
} as const;

export type EmailTemplate =
  (typeof EmailTemplates)[keyof typeof EmailTemplates];

export type ResolvedEmail = {
  subject: string;
  react: ReactNode;
};

type TemplateData = Record<string, unknown>;

type TemplateEntry = (data: TemplateData) => ResolvedEmail;

/** Best-effort order number for subject lines; falls back to an empty string. */
function orderNumber(data: TemplateData): string {
  const order = data.order as { display_id?: number | string } | undefined;

  return order?.display_id ? `#${order.display_id}` : "";
}

/** The product title for alert subject lines. */
function productTitle(data: TemplateData): string {
  const product = data.product as { title?: string } | undefined;
  return product?.title || "Your item";
}

const registry: Record<EmailTemplate, TemplateEntry> = {
  [EmailTemplates.ORDER_PLACED]: (data) => ({
    subject:
      `Your ${STORE_NAME} order ${orderNumber(data)} is confirmed`.trim(),
    react: orderPlacedEmail(data as Parameters<typeof orderPlacedEmail>[0]),
  }),
  [EmailTemplates.ORDER_UPDATED]: (data) => {
    const number = orderNumber(data);

    return {
      subject: number
        ? `Your order ${number} has been updated`
        : "Your order has been updated",
      react: orderUpdatedEmail(data as Parameters<typeof orderUpdatedEmail>[0]),
    };
  },
  [EmailTemplates.ORDER_SHIPPED]: (data) => ({
    subject: `Your order ${orderNumber(data)} has shipped`.trim(),
    react: orderShippedEmail(data as Parameters<typeof orderShippedEmail>[0]),
  }),
  [EmailTemplates.ORDER_DELIVERED]: (data) => {
    const number = orderNumber(data);

    return {
      subject: number
        ? `Your order ${number} has been delivered`
        : "Your order has been delivered",
      react: orderDeliveredEmail(
        data as Parameters<typeof orderDeliveredEmail>[0],
      ),
    };
  },
  [EmailTemplates.ORDER_CANCELED]: (data) => ({
    subject: `Your order ${orderNumber(data)} was canceled`.trim(),
    react: orderCanceledEmail(data as Parameters<typeof orderCanceledEmail>[0]),
  }),
  [EmailTemplates.REFUND_ISSUED]: (data) => {
    const number = orderNumber(data);

    return {
      subject: number
        ? `Your refund for order ${number} is on its way`
        : "Your refund is on its way",
      react: refundIssuedEmail(data as Parameters<typeof refundIssuedEmail>[0]),
    };
  },
  [EmailTemplates.RETURN_REQUESTED]: (data) => {
    const number = orderNumber(data);

    return {
      subject: number
        ? `Your return for order ${number} is booked`
        : "Your return is booked",
      react: returnRequestedEmail(
        data as Parameters<typeof returnRequestedEmail>[0],
      ),
    };
  },
  [EmailTemplates.RETURN_RECEIVED]: (data) => {
    const number = orderNumber(data);

    return {
      subject: number
        ? `We have received your return for order ${number}`
        : "We have received your return",
      react: returnReceivedEmail(
        data as Parameters<typeof returnReceivedEmail>[0],
      ),
    };
  },
  [EmailTemplates.EXCHANGE_CREATED]: (data) => {
    const number = orderNumber(data);

    return {
      subject: number
        ? `Your exchange for order ${number} is confirmed`
        : "Your exchange is confirmed",
      react: exchangeCreatedEmail(
        data as Parameters<typeof exchangeCreatedEmail>[0],
      ),
    };
  },
  [EmailTemplates.CLAIM_CREATED]: (data) => {
    const number = orderNumber(data);

    return {
      subject: number
        ? `We are sorting out order ${number}`
        : "We are sorting out your order",
      react: claimCreatedEmail(data as Parameters<typeof claimCreatedEmail>[0]),
    };
  },
  [EmailTemplates.RETURN_ACCESS]: (data) => {
    const number = orderNumber(data);
    return {
      subject: number
        ? `Your link to return items from order ${number}`
        : "Your link to return items",
      react: returnAccessEmail(data as Parameters<typeof returnAccessEmail>[0]),
    };
  },
  [EmailTemplates.CONTACT_MESSAGE]: (data) => {
    const { name, topic } = data as { name?: string; topic?: string };
    return {
      subject: `Contact form: ${topic ? `${topic}, ` : ""}from ${name ?? "a customer"}`,
      react: contactMessageEmail(
        data as Parameters<typeof contactMessageEmail>[0],
      ),
    };
  },
  [EmailTemplates.CONTACT_RECEIVED]: (data) => ({
    subject: brandName(data, `We've got your message`),
    react: contactReceivedEmail(
      data as Parameters<typeof contactReceivedEmail>[0],
    ),
  }),
  [EmailTemplates.PASSWORD_RESET]: (data) => ({
    subject: `Reset your ${STORE_NAME} password`,
    react: passwordResetEmail(data as Parameters<typeof passwordResetEmail>[0]),
  }),
  [EmailTemplates.EMAIL_VERIFICATION]: (data) => ({
    subject: brandName(data, `Confirm your email address for ${STORE_NAME}`),
    react: emailVerificationEmail(
      data as Parameters<typeof emailVerificationEmail>[0],
    ),
  }),
  [EmailTemplates.INVITE_USER]: (data) => ({
    subject: `You have been invited to ${STORE_NAME}`,
    react: inviteUserEmail(data as Parameters<typeof inviteUserEmail>[0]),
  }),
  [EmailTemplates.NEWSLETTER_CONFIRM]: (data) => ({
    subject: brandName(data, `Confirm your ${STORE_NAME} subscription`),
    react: newsletterConfirmEmail(
      data as Parameters<typeof newsletterConfirmEmail>[0],
    ),
  }),
  [EmailTemplates.NEWSLETTER_WELCOME]: (data) => ({
    subject: brandName(data, `Welcome to ${STORE_NAME}`),
    react: newsletterWelcomeEmail(
      data as Parameters<typeof newsletterWelcomeEmail>[0],
    ),
  }),
  [EmailTemplates.PRODUCT_BACK_IN_STOCK]: (data) => ({
    subject: `${productTitle(data)} is back in stock`,
    react: productAvailableEmail({
      ...(data as Parameters<typeof productAvailableEmail>[0]),
      reason: "restock",
    }),
  }),
  [EmailTemplates.PRODUCT_LAUNCHED]: (data) => ({
    subject: `${productTitle(data)} is now available`,
    react: productAvailableEmail({
      ...(data as Parameters<typeof productAvailableEmail>[0]),
      reason: "launch",
    }),
  }),
  [EmailTemplates.CART_REMINDER]: (data) => {
    const props = data as Parameters<typeof cartReminderEmail>[0];
    const brand = data.brand as { name?: string | null } | undefined;

    return {
      subject: cartReminderCopy(
        props.reminder_number,
        props.total_reminders,
        brand?.name || STORE_NAME,
      ).subject,
      react: cartReminderEmail(props),
    };
  },
};

/** Uses the live store name in the subject when branding was passed in. */
function brandName(data: TemplateData, fallback: string): string {
  const brand = data.brand as { name?: string | null } | undefined;

  return brand?.name ? fallback.replace(STORE_NAME, brand.name) : fallback;
}

/**
 * Returns the rendered component and default subject for a template name, or
 * undefined when the name is not one of ours -- the provider then falls back
 * to the inline `content` a caller supplied.
 */
export function resolveEmailTemplate(
  template: string,
  data?: Record<string, unknown> | null,
): ResolvedEmail | undefined {
  const entry = registry[template as EmailTemplate];

  return entry ? entry(data ?? {}) : undefined;
}
