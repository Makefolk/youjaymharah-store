import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ExclamationCircle, Spinner } from "@medusajs/icons";
import { Badge, Container, Heading, Text } from "@medusajs/ui";
import { useQuery } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { sdk } from "../../lib/sdk";

type Attention = {
  support_open: number;
  emails_to_review: number;
  payments: {
    session_id: string;
    reference: string | null;
    provider_id: string;
    amount: number;
    currency_code: string;
    email: string | null;
    created_at: string;
    verdict: "paid_no_order" | "amount_mismatch" | "pending";
  }[];
  returns: {
    id: string;
    order_id: string;
    display_id: number;
    requested_at: string;
  }[];
  unshipped: {
    id: string;
    display_id: number;
    email: string | null;
    created_at: string;
  }[];
};

const VERDICTS = {
  paid_no_order: { label: "Paid, no order", color: "red" },
  amount_mismatch: { label: "Paid a different amount", color: "orange" },
  pending: { label: "Not finished", color: "orange" },
} as const;

const GATEWAY_NAMES: Record<string, string> = {
  pp_paystack_paystack: "Paystack",
  pp_credo_credo: "Credo",
};

const money = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount} ${currency.toUpperCase()}`;
  }
};

const ago = (value: string) => {
  const days = Math.floor(
    (Date.now() - new Date(value).getTime()) / 86_400_000,
  );
  if (days >= 1) return `${days} ${days === 1 ? "day" : "days"} ago`;
  const hours = Math.max(
    1,
    Math.floor((Date.now() - new Date(value).getTime()) / 3_600_000),
  );
  return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
};

const linkClass = "text-ui-fg-interactive txt-compact-small-plus";

/**
 * One place for what is waiting on a person: payments that went through
 * without an order, emails nobody knows arrived, return requests waiting to
 * be collected and paid orders not yet shipped.
 */
const AttentionPage = () => {
  const query = useQuery({
    queryKey: ["attention"],
    queryFn: () => sdk.client.fetch<Attention>("/admin/attention"),
  });
  const data = query.data;
  const total = data
    ? data.payments.length +
      data.returns.length +
      data.unshipped.length +
      (data.emails_to_review ? 1 : 0) +
      (data.support_open ? 1 : 0)
    : 0;

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="flex flex-col gap-y-1 px-6 py-4">
        <div className="flex items-center gap-x-2">
          <Heading level="h1">Needs attention</Heading>
          {data && (
            <Badge size="2xsmall" color={total ? "orange" : "green"}>
              {total ? `${total} to look at` : "All clear"}
            </Badge>
          )}
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          Payments without an order are rechecked with the gateway every few
          minutes. Returns and orders appear after waiting three days.
        </Text>
      </Container>

      {query.isLoading ? (
        <Container className="flex justify-center px-6 py-8">
          <Spinner className="text-ui-fg-subtle animate-spin" />
        </Container>
      ) : query.isError || !data ? (
        <Container className="px-6 py-4">
          <Text size="small" className="text-ui-fg-error">
            Couldn't load what needs attention.
          </Text>
        </Container>
      ) : (
        <>
          <Section
            title="Customers waiting for a reply"
            hint="Support requests where the customer is waiting on us."
            empty="None."
            rows={
              data.support_open
                ? [
                    <Row
                      key="support"
                      title={`${data.support_open} ${
                        data.support_open === 1 ? "request" : "requests"
                      } waiting`}
                      action={
                        <Link to="/support-inbox" className={linkClass}>
                          Open Support inbox
                        </Link>
                      }
                    />,
                  ]
                : []
            }
          />

          <Section
            title="Payments without an order"
            hint="The customer paid (or may have) but no order was made. Open each in Payment lookup to create the order or see what to do."
            empty="None in the last three days."
            rows={data.payments.map((payment) => (
              <Row
                key={payment.session_id}
                badge={VERDICTS[payment.verdict]}
                title={`${money(payment.amount, payment.currency_code)} via ${
                  GATEWAY_NAMES[payment.provider_id] ?? payment.provider_id
                }`}
                detail={`${payment.email ?? "No email"} · ${ago(payment.created_at)}`}
                action={
                  payment.reference && (
                    <Link
                      to={`/payment-lookup?reference=${encodeURIComponent(payment.reference)}`}
                      className={linkClass}
                    >
                      Open in Payment lookup
                    </Link>
                  )
                }
              />
            ))}
          />

          <Section
            title="Emails with an unknown outcome"
            hint="Check them against Resend's email log."
            empty="None."
            rows={
              data.emails_to_review
                ? [
                    <Row
                      key="emails"
                      title={`${data.emails_to_review} ${
                        data.emails_to_review === 1 ? "email" : "emails"
                      } to check`}
                      action={
                        <Link to="/email-review" className={linkClass}>
                          Open Email review
                        </Link>
                      }
                    />,
                  ]
                : []
            }
          />

          <Section
            title="Return requests waiting"
            hint="Requested over three days ago and not yet received. Arrange collection or drop-off with the customer."
            empty="None."
            rows={data.returns.map((entry) => (
              <Row
                key={entry.id}
                title={`Order #${entry.display_id}`}
                detail={`Requested ${ago(entry.requested_at)}`}
                action={
                  <Link to={`/orders/${entry.order_id}`} className={linkClass}>
                    Open the order
                  </Link>
                }
              />
            ))}
          />

          <Section
            title="Paid orders not shipped"
            hint="Placed over three days ago with nothing shipped yet."
            empty="None."
            rows={data.unshipped.map((order) => (
              <Row
                key={order.id}
                title={`Order #${order.display_id}`}
                detail={`${order.email ?? "No email"} · placed ${ago(order.created_at)}`}
                action={
                  <Link to={`/orders/${order.id}`} className={linkClass}>
                    Open the order
                  </Link>
                }
              />
            ))}
          />
        </>
      )}
    </div>
  );
};

const Section = ({
  title,
  hint,
  empty,
  rows,
}: {
  title: string;
  hint: string;
  empty: string;
  rows: ReactNode[];
}) => (
  <Container className="divide-y p-0">
    <div className="flex flex-col gap-y-1 px-6 py-4">
      <div className="flex items-center gap-x-2">
        <Heading level="h2">{title}</Heading>
        <Badge size="2xsmall" color={rows.length ? "orange" : "grey"}>
          {rows.length}
        </Badge>
      </div>
      <Text size="small" className="text-ui-fg-subtle">
        {hint}
      </Text>
    </div>
    {rows.length ? (
      rows
    ) : (
      <Text size="small" className="text-ui-fg-subtle px-6 py-4">
        {empty}
      </Text>
    )}
  </Container>
);

const Row = ({
  title,
  detail,
  badge,
  action,
}: {
  title: string;
  detail?: string;
  badge?: { label: string; color: "red" | "orange" };
  action?: ReactNode;
}) => (
  <div className="flex flex-col gap-2 px-6 py-3 md:flex-row md:items-center md:justify-between">
    <div className="flex flex-col gap-y-0.5">
      <div className="flex flex-wrap items-center gap-2">
        <Text size="small" leading="compact" weight="plus">
          {title}
        </Text>
        {badge && (
          <Badge size="2xsmall" color={badge.color}>
            {badge.label}
          </Badge>
        )}
      </div>
      {detail && (
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          {detail}
        </Text>
      )}
    </div>
    {action}
  </div>
);

export const config = defineRouteConfig({
  label: "Needs attention",
  icon: ExclamationCircle,
});

export default AttentionPage;
