import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type {
  AdminCustomer,
  DetailWidgetProps,
} from "@medusajs/framework/types";
import { Container, Heading, StatusBadge, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import {
  EmailHistoryList,
  type EmailHistoryEntry,
} from "../../components/email-history/email-history-list";
import { RenderFromQuery } from "../../components/render-from-query";
import { sdk } from "../../lib/sdk";
import { withPermission } from "../../lib/permissions";

type ProductRef = {
  id: string;
  title: string | null;
  thumbnail: string | null;
};

type SupportContext = {
  email: string | null;
  emails: EmailHistoryEntry[];
  newsletter: {
    status: "pending" | "subscribed" | "unsubscribed";
    confirmed_at: string | null;
    unsubscribed_at: string | null;
    suppressed_at: string | null;
    suppression_reason:
      "hard_bounce" | "complaint" | "provider_suppression" | null;
  } | null;
  wishlist: {
    count: number;
    items: {
      id: string;
      product: ProductRef;
      variant_title: string | null;
      created_at: string;
    }[];
  };
  product_alerts: {
    count: number;
    items: {
      id: string;
      product: ProductRef;
      variant_title: string | null;
      reason: "restock" | "launch";
      status: "waiting" | "sent" | "cancelled" | "failed";
      notified_at: string | null;
      created_at: string;
    }[];
  };
  cart_reminders: {
    count: number;
    opted_out: boolean;
    items: {
      id: string;
      cart_id: string;
      status: "active" | "finished" | "recovered" | "stopped" | "failed";
      reminders_sent: number;
      last_sent_at: string | null;
      restored_at: string | null;
      recovered_at: string | null;
      order_id: string | null;
    }[];
  };
};

const SUPPRESSION_REASONS = {
  hard_bounce: "their address bounced",
  complaint: "they marked an email as spam",
  provider_suppression: "Resend suppressed the address",
};

const ALERT_STATUS = {
  waiting: { label: "Waiting", color: "blue" },
  sent: { label: "Notified", color: "green" },
  cancelled: { label: "Cancelled", color: "grey" },
  failed: { label: "Failed", color: "red" },
} as const;

const REMINDER_STATUS = {
  active: { label: "Reminding", color: "blue" },
  finished: { label: "Finished", color: "grey" },
  recovered: { label: "Ordered", color: "green" },
  stopped: { label: "Stopped", color: "grey" },
  failed: { label: "Failed", color: "red" },
} as const;

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { dateStyle: "medium" });

function Section({
  title,
  count,
  children,
}: {
  title: string;
  count?: number;
  children: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-y-3 px-6 py-4">
      <Text size="small" leading="compact" weight="plus">
        {title}
        {count ? (
          <span className="text-ui-fg-subtle font-normal"> · {count}</span>
        ) : null}
      </Text>
      {children}
    </div>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return (
    <Text size="small" leading="compact" className="text-ui-fg-subtle">
      {children}
    </Text>
  );
}

function ProductLine({
  product,
  variantTitle,
  aside,
}: {
  product: ProductRef;
  variantTitle: string | null;
  aside: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-x-3">
      <div className="flex min-w-0 items-center gap-x-3">
        {product.thumbnail ? (
          <img
            src={product.thumbnail}
            alt=""
            className="size-8 shrink-0 rounded object-cover"
          />
        ) : (
          <div className="bg-ui-bg-component size-8 shrink-0 rounded" />
        )}
        <div className="flex min-w-0 flex-col">
          {product.title ? (
            <Link
              to={`/products/${product.id}`}
              className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover txt-compact-small truncate"
            >
              {product.title}
            </Link>
          ) : (
            <Muted>A deleted product</Muted>
          )}
          {variantTitle ? <Muted>{variantTitle}</Muted> : null}
        </div>
      </div>
      {aside}
    </div>
  );
}

/**
 * Beside Medusa's customer page: whether emails reach this customer, and what
 * they saved, asked to be told about, or left in their bag.
 */
const CustomerSupportWidget = ({
  data: customer,
}: DetailWidgetProps<AdminCustomer>) => {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["customer-support-context", customer.id],
    queryFn: () =>
      sdk.client.fetch<SupportContext>(
        `/admin/customers/${customer.id}/support-context`,
      ),
  });

  function renderEmailStatus(context: SupportContext) {
    const notes: string[] = [];
    const newsletter = context.newsletter;
    if (newsletter?.suppressed_at) {
      notes.push(
        `Marketing emails stopped on ${formatDate(newsletter.suppressed_at)}: ${
          SUPPRESSION_REASONS[
            newsletter.suppression_reason ?? "provider_suppression"
          ]
        }.`,
      );
    }
    notes.push(
      newsletter
        ? newsletter.status === "subscribed"
          ? "Subscribed to the newsletter."
          : newsletter.status === "pending"
            ? "Newsletter signup not confirmed yet."
            : "Unsubscribed from the newsletter."
        : "Not on the newsletter list.",
    );
    if (context.cart_reminders.opted_out) {
      notes.push("Turned off bag reminder emails.");
    }
    return notes.map((note) => <Muted key={note}>{note}</Muted>);
  }

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Support</Heading>
      </div>
      <RenderFromQuery
        isLoading={isLoading}
        isError={isError}
        loading={
          <div className="px-6 py-4">
            <Muted>Loading…</Muted>
          </div>
        }
        error={
          <div className="px-6 py-4">
            <Text size="small" leading="compact" className="text-ui-fg-error">
              Couldn't load this customer's support details.
            </Text>
          </div>
        }
      >
        {data ? (
          <>
            <Section title="Emails">
              {data.emails.length ? (
                <EmailHistoryList emails={data.emails} showRecipient={false} />
              ) : (
                <Muted>
                  No emails sent to {data.email ?? "this customer"}.
                </Muted>
              )}
            </Section>

            <Section title="Email preferences">
              {renderEmailStatus(data)}
            </Section>

            <Section title="Wishlist" count={data.wishlist.count}>
              {data.wishlist.items.length ? (
                data.wishlist.items.map((item) => (
                  <ProductLine
                    key={item.id}
                    product={item.product}
                    variantTitle={item.variant_title}
                    aside={<Muted>{formatDate(item.created_at)}</Muted>}
                  />
                ))
              ) : (
                <Muted>Nothing saved.</Muted>
              )}
            </Section>

            <Section title="Notify me" count={data.product_alerts.count}>
              {data.product_alerts.items.length ? (
                data.product_alerts.items.map((alert) => (
                  <ProductLine
                    key={alert.id}
                    product={alert.product}
                    variantTitle={alert.variant_title}
                    aside={
                      <StatusBadge color={ALERT_STATUS[alert.status].color}>
                        {ALERT_STATUS[alert.status].label}
                      </StatusBadge>
                    }
                  />
                ))
              ) : (
                <Muted>No alerts.</Muted>
              )}
            </Section>

            <Section title="Bag reminders" count={data.cart_reminders.count}>
              {data.cart_reminders.items.length ? (
                data.cart_reminders.items.map((reminder) => (
                  <div
                    key={reminder.id}
                    className="flex items-center justify-between gap-x-3"
                  >
                    <div className="flex flex-col">
                      <Text size="small" leading="compact">
                        {reminder.reminders_sent}{" "}
                        {reminder.reminders_sent === 1
                          ? "reminder"
                          : "reminders"}
                        {reminder.last_sent_at
                          ? `, last ${formatDate(reminder.last_sent_at)}`
                          : ""}
                      </Text>
                      {reminder.order_id ? (
                        <Link
                          to={`/orders/${reminder.order_id}`}
                          className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover txt-compact-small"
                        >
                          View order
                        </Link>
                      ) : reminder.restored_at ? (
                        <Muted>
                          Opened the bag {formatDate(reminder.restored_at)}
                        </Muted>
                      ) : null}
                    </div>
                    <StatusBadge color={REMINDER_STATUS[reminder.status].color}>
                      {REMINDER_STATUS[reminder.status].label}
                    </StatusBadge>
                  </div>
                ))
              ) : (
                <Muted>No bag reminders sent.</Muted>
              )}
            </Section>
          </>
        ) : null}
      </RenderFromQuery>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "customer.details",
});

export default withPermission(CustomerSupportWidget, "customer", "read");
