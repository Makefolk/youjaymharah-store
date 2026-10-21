import { StatusBadge, Text } from "@medusajs/ui";

export type EmailHistoryEntry = {
  id: string;
  template: string;
  to: string;
  status: "sending" | "sent" | "failed" | "needs_review";
  created_at: string;
  sent_at: string | null;
  outcome:
    | "delivered"
    | "delayed"
    | "bounced"
    | "complained"
    | "suppressed"
    | "failed"
    | null;
  outcome_at: string | null;
  outcome_detail: string | null;
};

export const TEMPLATE_LABELS: Record<string, string> = {
  "order-placed": "Order confirmation",
  "order-updated": "Order updated",
  "order-shipped": "Shipped",
  "order-delivered": "Delivered",
  "order-canceled": "Order canceled",
  "refund-issued": "Refund issued",
  "return-requested": "Return requested",
  "return-received": "Return received",
  "exchange-created": "Exchange created",
  "claim-created": "Claim created",
  "password-reset": "Password reset",
  "email-verification": "Email verification",
  "invite-user": "Staff invite",
  "newsletter-confirm": "Newsletter confirmation",
  "newsletter-welcome": "Newsletter welcome",
  "product-back-in-stock": "Back in stock",
  "product-launched": "Product launched",
  "cart-reminder": "Bag reminder",
  "return-access": "Return link",
  "contact-message": "Contact form message",
  "contact-received": "Contact form reply",
};

type BadgeColor = "green" | "red" | "orange" | "blue" | "grey";

/** What a support agent needs to know: did it reach the customer? */
function describeState(email: EmailHistoryEntry): {
  label: string;
  color: BadgeColor;
  hint?: string;
} {
  if (email.status === "needs_review") {
    return {
      label: "Needs review",
      color: "orange",
      hint: "Unclear whether it was sent, so it won't be retried automatically.",
    };
  }
  if (email.status === "failed") {
    return {
      label: "Not sent",
      color: "red",
      hint: "Resend refused it on every attempt.",
    };
  }
  if (email.status === "sending") {
    return { label: "Sending", color: "grey" };
  }
  switch (email.outcome) {
    case "delivered":
      return { label: "Delivered", color: "green" };
    case "delayed":
      return {
        label: "Delayed",
        color: "orange",
        hint: "The receiving server hasn't accepted it yet; Resend keeps trying.",
      };
    case "bounced":
      return {
        label: "Bounced",
        color: "red",
        hint: "The address rejected it. Check it for typos.",
      };
    case "complained":
      return {
        label: "Marked as spam",
        color: "red",
        hint: "The customer reported it as spam.",
      };
    case "suppressed":
      return {
        label: "Suppressed",
        color: "red",
        hint: "Not sent: the address bounced or complained before.",
      };
    case "failed":
      return { label: "Failed", color: "red" };
    default:
      return { label: "Sent", color: "blue" };
  }
}

const formatDate = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

export function EmailHistoryList({
  emails,
  showRecipient = true,
}: {
  emails: EmailHistoryEntry[];
  showRecipient?: boolean;
}) {
  return (
    <div className="flex flex-col gap-y-3">
      {emails.map((email) => {
        const state = describeState(email);
        return (
          <div key={email.id} className="flex flex-col gap-y-1">
            <div className="flex items-center justify-between gap-x-2">
              <Text size="small" leading="compact" weight="plus">
                {TEMPLATE_LABELS[email.template] ?? email.template}
              </Text>
              <StatusBadge color={state.color}>{state.label}</StatusBadge>
            </div>
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              {showRecipient ? `${email.to} · ` : ""}
              {formatDate(email.sent_at ?? email.created_at)}
            </Text>
            {state.hint || email.outcome_detail ? (
              <Text
                size="xsmall"
                leading="compact"
                className="text-ui-fg-muted"
              >
                {[state.hint, email.outcome_detail].filter(Boolean).join(" ")}
              </Text>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
