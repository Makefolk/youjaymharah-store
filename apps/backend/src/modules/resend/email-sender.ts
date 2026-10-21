import type { EmailTemplate } from "./emails";
import { STORE_NAME } from "./emails/constants";

type SenderGroup = "onboarding" | "accounts" | "orders" | "marketing";

export type EmailSenderOptions = {
  from: string;
  from_addresses?: Partial<Record<SenderGroup, string>>;
  /** Used when an email carries neither its own reply-to nor brand data. */
  reply_to?: string;
};

const templateSenders = {
  "order-placed": "orders",
  "order-updated": "orders",
  "order-shipped": "orders",
  "order-delivered": "orders",
  "order-canceled": "orders",
  "refund-issued": "orders",
  "return-requested": "orders",
  "return-access": "orders",
  "return-received": "orders",
  "exchange-created": "orders",
  "claim-created": "orders",
  "password-reset": "accounts",
  "email-verification": "onboarding",
  "invite-user": "accounts",
  "newsletter-confirm": "marketing",
  "newsletter-welcome": "marketing",
  "product-back-in-stock": "marketing",
  "product-launched": "marketing",
  "cart-reminder": "marketing",
  "support-staff": "accounts",
  "support-customer": "accounts",
} satisfies Record<EmailTemplate, SenderGroup>;

const senders: Record<SenderGroup, { name: string; mailbox: string }> = {
  onboarding: { name: STORE_NAME, mailbox: "onboarding" },
  accounts: { name: STORE_NAME, mailbox: "accounts" },
  orders: { name: `${STORE_NAME} Orders`, mailbox: "orders" },
  marketing: { name: "The YJ Edit", mailbox: "hello" },
};

export function resolveEmailSender(
  template: string,
  options: EmailSenderOptions,
  explicitFrom?: string | null,
): string {
  if (explicitFrom?.trim()) return explicitFrom.trim();

  const fallback = options.from.trim();
  if (!Object.prototype.hasOwnProperty.call(templateSenders, template))
    return fallback;

  const group = templateSenders[template as EmailTemplate];
  const override = options.from_addresses?.[group]?.trim();
  if (override) return override;

  const address = fallback.match(/<([^<>]+)>$/)?.[1] ?? fallback;
  const domain = address.match(/^[^\s<>@]+@([^\s<>@]+)$/)?.[1];
  // Resend's shared testing domain must keep the configured test sender.
  if (!domain || domain.toLowerCase() === "resend.dev") return fallback;

  const sender = senders[group];
  return `${sender.name} <${sender.mailbox}@${domain}>`;
}

const nonEmpty = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

/**
 * Where a customer's reply goes. The sending mailboxes (orders@, accounts@)
 * may not be read, so without this a reply to an order email can vanish.
 * The brand's support address is the one the email footers already show,
 * and it follows edits made in the dashboard.
 */
export function resolveReplyTo(
  data: Record<string, unknown> | null | undefined,
  options: EmailSenderOptions,
): string | undefined {
  const brand = data?.brand as { support_email?: unknown } | undefined;
  return (
    nonEmpty(data?.reply_to) ??
    nonEmpty(brand?.support_email) ??
    nonEmpty(options.reply_to)
  );
}
