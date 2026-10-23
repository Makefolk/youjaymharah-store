import { defineRouteConfig } from "@medusajs/admin-sdk";
import { ExclamationCircle, Spinner } from "@medusajs/icons";
import {
  Badge,
  Button,
  Container,
  Drawer,
  Heading,
  Label,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { usePermissions } from "../../lib/permissions";
import { sdk } from "../../lib/sdk";

type Attention = {
  support_open: number;
  emails_to_review: number;
  payments: Payment[];
  payments_count: number;
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

type Payment = {
  id: string;
  session_id: string;
  reference: string | null;
  provider_id: string;
  amount: number;
  currency_code: string;
  email: string | null;
  created_at: string;
  verdict: "paid_no_order" | "amount_mismatch" | "pending" | "stale";
};

const VERDICTS = {
  paid_no_order: { label: "Paid, no order", color: "red" },
  amount_mismatch: { label: "Paid a different amount", color: "orange" },
  pending: { label: "Not finished", color: "orange" },
  stale: { label: "Unfinished for a week", color: "red" },
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
  const { can } = usePermissions();
  const [handling, setHandling] = useState<Payment | null>(null);
  const query = useQuery({
    queryKey: ["attention"],
    queryFn: () => sdk.client.fetch<Attention>("/admin/attention"),
  });
  const data = query.data;
  const total = data
    ? data.payments_count +
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
          Every gateway payment without an order is rechecked with the gateway
          until it clears: unfinished ones less often as time goes on. Returns
          and orders appear after waiting three days.
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
            hint={`The customer paid (or may have) but no order was made. Open each in Payment lookup to create the order or see what to do; one that becomes an order clears itself. Mark one handled once you've dealt with it another way.${
              data.payments_count > data.payments.length
                ? ` Showing the newest ${data.payments.length} of ${data.payments_count}.`
                : ""
            }`}
            empty="None."
            rows={data.payments.map((payment) => (
              <Row
                key={payment.session_id}
                badge={VERDICTS[payment.verdict]}
                title={`${money(payment.amount, payment.currency_code)} via ${
                  GATEWAY_NAMES[payment.provider_id] ?? payment.provider_id
                }`}
                detail={`${payment.email ?? "No email"} · ${ago(payment.created_at)}`}
                action={
                  <div className="flex items-center gap-x-4">
                    {payment.reference && (
                      <Link
                        to={`/payment-lookup?reference=${encodeURIComponent(payment.reference)}`}
                        className={linkClass}
                      >
                        Open in Payment lookup
                      </Link>
                    )}
                    {can("order", "update") && (
                      <Button
                        size="small"
                        variant="secondary"
                        onClick={() => setHandling(payment)}
                      >
                        Mark handled
                      </Button>
                    )}
                  </div>
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
      {handling && (
        <MarkHandled payment={handling} onClose={() => setHandling(null)} />
      )}
    </div>
  );
};

/** Records how staff dealt with a flagged payment, then drops it. */
const MarkHandled = ({
  payment,
  onClose,
}: {
  payment: Payment;
  onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const [note, setNote] = useState("");
  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/payment-checks/${payment.id}/resolve`, {
        method: "POST",
        body: { note: note.trim() },
      }),
    onSuccess: () => {
      toast.success("Marked handled.");
      void queryClient.invalidateQueries({ queryKey: ["attention"] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Mark payment handled</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-4">
          <Text size="small" className="text-ui-fg-subtle">
            {money(payment.amount, payment.currency_code)} via{" "}
            {GATEWAY_NAMES[payment.provider_id] ?? payment.provider_id}
            {payment.email ? ` from ${payment.email}` : ""}. Only for one you
            dealt with outside the store, such as a refund in the gateway's
            dashboard: creating its order clears it by itself.
          </Text>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="payment-handled-note" size="small" weight="plus">
              What you did
            </Label>
            <Textarea
              id="payment-handled-note"
              rows={3}
              maxLength={500}
              placeholder="Refunded in Paystack and told the customer."
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </Drawer.Body>
        <Drawer.Footer>
          <Button
            size="small"
            variant="secondary"
            disabled={save.isPending}
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            size="small"
            isLoading={save.isPending}
            disabled={note.trim().length < 3}
            onClick={() => save.mutate()}
          >
            Mark handled
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
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
