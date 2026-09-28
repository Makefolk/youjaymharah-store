import type { EmailTemplate } from "./emails";
import { STORE_NAME } from "./emails/constants";

type SenderGroup = "onboarding" | "accounts" | "orders" | "marketing";

export type EmailSenderOptions = {
  from: string;
  from_addresses?: Partial<Record<SenderGroup, string>>;
};

const templateSenders = {
  "order-placed": "orders",
  "order-updated": "orders",
  "order-shipped": "orders",
  "order-delivered": "orders",
  "order-canceled": "orders",
  "refund-issued": "orders",
  "return-requested": "orders",
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
