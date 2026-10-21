import { defineRouteConfig } from "@medusajs/admin-sdk";
import { CreditCard, Spinner } from "@medusajs/icons";
import {
  Button,
  Container,
  Heading,
  Input,
  Label,
  StatusBadge,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { Link } from "react-router-dom";

import { usePermissions } from "../../lib/permissions";
import { sdk } from "../../lib/sdk";

type PaymentAttempt = {
  session_id: string;
  reference: string | null;
  provider_id: string;
  status: string;
  amount: number;
  currency_code: string;
  created_at: string;
  cart: {
    id: string;
    email: string | null;
    completed_at: string | null;
  } | null;
  order: { id: string; display_id: number } | null;
};

type GatewayCheck =
  | {
      checked: true;
      status: "successful" | "pending" | "failed" | "canceled";
      amount_in_minor: number | null;
      currency_code: string | null;
    }
  | { checked: false; reason: string };

type Verdict =
  "order_placed" | "paid_no_order" | "amount_mismatch" | "not_paid" | "unknown";

type LookupResult = {
  attempt: PaymentAttempt;
  gateway: GatewayCheck;
  verdict: Verdict;
};

const PROVIDERS: Record<string, string> = {
  pp_paystack_paystack: "Paystack",
  pp_credo_credo: "Credo",
  pp_system_default: "Manual (test)",
};

const VERDICTS: Record<
  Verdict,
  { label: string; color: "green" | "red" | "orange" | "grey"; advice: string }
> = {
  order_placed: {
    label: "Order placed",
    color: "green",
    advice: "Nothing is missing. Send the customer their order number.",
  },
  paid_no_order: {
    label: "Paid, no order",
    color: "red",
    advice:
      "The gateway took the money but no order was created, usually because the customer closed the page before returning. Create the order below; the customer gets the usual confirmation email.",
  },
  amount_mismatch: {
    label: "Paid a different amount",
    color: "orange",
    advice:
      "The amount paid doesn't match the bag, so no order can be made from it. Refund the payment from the gateway's dashboard and ask the customer to order again.",
  },
  not_paid: {
    label: "Not paid",
    color: "grey",
    advice:
      "The gateway has no successful payment for this reference, so the customer wasn't charged. They can check out again. If their bank shows a debit, it is usually reversed within a few days; ask them to share the alert if not.",
  },
  unknown: {
    label: "Couldn't check",
    color: "orange",
    advice:
      "The gateway couldn't be asked just now. Try again in a minute, or look the reference up in the gateway's dashboard.",
  },
};

const formatAmount = (amount: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(amount);
  } catch {
    return `${amount} ${currency.toUpperCase()}`;
  }
};

const formatDate = (value: string) =>
  new Date(value).toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });

/**
 * "I paid but got no order": paste the reference from the customer's
 * receipt or bank alert (or search by their email to find it) and see what
 * the gateway says and what to do.
 */
const PaymentLookupPage = () => {
  const { can, isPending: permissionsPending } = usePermissions();
  const [input, setInput] = useState("");
  const [search, setSearch] = useState<
    { reference: string } | { email: string } | null
  >(null);

  const results = useQuery({
    queryKey: ["payment-lookup", search],
    queryFn: () =>
      sdk.client.fetch<LookupResult | { attempts: PaymentAttempt[] }>(
        "/admin/payment-lookup",
        { query: search! },
      ),
    enabled: search !== null,
    retry: false,
  });

  const submit = () => {
    const value = input.trim();
    if (!value) return;
    setSearch(value.includes("@") ? { email: value } : { reference: value });
  };

  if (!permissionsPending && !can("order", "read")) {
    return (
      <Container className="px-6 py-4">
        <Text size="small" className="text-ui-fg-subtle">
          You need access to orders to look up payments.
        </Text>
      </Container>
    );
  }

  return (
    <div className="flex flex-col gap-y-3">
      <Container className="divide-y p-0">
        <div className="flex flex-col gap-y-1 px-6 py-4">
          <Heading level="h1">Payment lookup</Heading>
          <Text size="small" className="text-ui-fg-subtle">
            For customers who paid but didn't get an order. Paste the payment
            reference from their Paystack or Credo receipt (it starts with
            "payses"), or their email to find it.
          </Text>
        </div>
        <form
          className="flex items-end gap-x-2 px-6 py-4"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <div className="flex flex-1 flex-col gap-y-2">
            <Label htmlFor="payment-lookup" size="small" weight="plus">
              Reference or email
            </Label>
            <Input
              id="payment-lookup"
              value={input}
              placeholder="payses01K… or customer@example.com"
              onChange={(event) => setInput(event.target.value)}
            />
          </div>
          <Button
            size="small"
            type="submit"
            isLoading={results.isFetching}
            disabled={!input.trim()}
          >
            Look up
          </Button>
        </form>
      </Container>

      {results.isFetching ? (
        <Container className="flex justify-center px-6 py-8">
          <Spinner className="text-ui-fg-subtle animate-spin" />
        </Container>
      ) : results.isError ? (
        <Container className="px-6 py-4">
          <Text size="small" className="text-ui-fg-error">
            {results.error.message}
          </Text>
        </Container>
      ) : results.data && "attempts" in results.data ? (
        <AttemptList
          attempts={results.data.attempts}
          onPick={(reference) => {
            setInput(reference);
            setSearch({ reference });
          }}
        />
      ) : results.data ? (
        <Result
          result={results.data}
          canCreate={can("order", "create")}
          queryKey={["payment-lookup", search]}
        />
      ) : null}
    </div>
  );
};

const Row = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid grid-cols-3 items-start gap-x-4 px-6 py-3">
    <Text size="small" leading="compact" weight="plus">
      {label}
    </Text>
    <div className="col-span-2">
      <Text size="small" leading="compact" className="text-ui-fg-subtle">
        {children}
      </Text>
    </div>
  </div>
);

const Result = ({
  result,
  canCreate,
  queryKey,
}: {
  result: LookupResult;
  canCreate: boolean;
  queryKey: unknown[];
}) => {
  const queryClient = useQueryClient();
  const prompt = usePrompt();
  const { attempt, gateway, verdict } = result;
  const shown = VERDICTS[verdict];

  const createOrder = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ order: { id: string; display_id: number } }>(
        "/admin/payment-lookup/create-order",
        { method: "POST", body: { session_id: attempt.session_id } },
      ),
    onSuccess: ({ order }) => {
      toast.success(`Order #${order.display_id} created.`);
      void queryClient.invalidateQueries({ queryKey });
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const confirmCreate = async () => {
    const confirmed = await prompt({
      title: "Create the order?",
      description: `The gateway is asked once more, then the order is created from ${attempt.cart?.email ?? "the customer"}'s bag as it was at checkout, and they're emailed a confirmation.`,
      confirmText: "Create order",
      cancelText: "Cancel",
    });
    if (confirmed) createOrder.mutate();
  };

  return (
    <Container className="divide-y p-0">
      <div className="flex flex-col gap-y-2 px-6 py-4">
        <div className="flex items-center justify-between gap-x-4">
          <StatusBadge color={shown.color}>{shown.label}</StatusBadge>
          {verdict === "paid_no_order" && canCreate && (
            <Button
              size="small"
              isLoading={createOrder.isPending}
              onClick={confirmCreate}
            >
              Create the order
            </Button>
          )}
        </div>
        <Text size="small" className="text-ui-fg-subtle">
          {shown.advice}
        </Text>
      </div>
      <Row label="Order">
        {attempt.order ? (
          <Link
            to={`/orders/${attempt.order.id}`}
            className="text-ui-fg-interactive hover:text-ui-fg-interactive-hover"
          >
            #{attempt.order.display_id}
          </Link>
        ) : (
          "None"
        )}
      </Row>
      <Row label="Customer email">{attempt.cart?.email ?? "Not entered"}</Row>
      <Row label="Amount">
        {formatAmount(attempt.amount, attempt.currency_code)} via{" "}
        {PROVIDERS[attempt.provider_id] ?? attempt.provider_id}
      </Row>
      <Row label="Gateway says">
        {gateway.checked
          ? `${gateway.status[0].toUpperCase()}${gateway.status.slice(1)}${
              gateway.amount_in_minor !== null && gateway.currency_code
                ? `, ${formatAmount(gateway.amount_in_minor / 100, gateway.currency_code)}`
                : ""
            }`
          : gateway.reason}
      </Row>
      <Row label="Reference">{attempt.reference ?? "None"}</Row>
      <Row label="Started">{formatDate(attempt.created_at)}</Row>
    </Container>
  );
};

const AttemptList = ({
  attempts,
  onPick,
}: {
  attempts: PaymentAttempt[];
  onPick: (reference: string) => void;
}) => (
  <Container className="divide-y p-0">
    <div className="px-6 py-4">
      <Text size="small" weight="plus">
        {attempts.length
          ? "Recent payment attempts"
          : "No payment attempts with this email."}
      </Text>
      {attempts.length > 0 && (
        <Text size="small" className="text-ui-fg-subtle">
          Newest first. Check one to ask the gateway what happened.
        </Text>
      )}
    </div>
    {attempts.map((attempt) => (
      <div
        key={attempt.session_id}
        className="flex items-center justify-between gap-x-4 px-6 py-3"
      >
        <div className="flex flex-col">
          <Text size="small" leading="compact" weight="plus">
            {formatAmount(attempt.amount, attempt.currency_code)} via{" "}
            {PROVIDERS[attempt.provider_id] ?? attempt.provider_id}
          </Text>
          <Text size="small" leading="compact" className="text-ui-fg-subtle">
            {formatDate(attempt.created_at)}
            {attempt.order
              ? ` · Order #${attempt.order.display_id}`
              : " · No order"}
          </Text>
        </div>
        <Button
          size="small"
          variant="secondary"
          disabled={
            !attempt.reference && attempt.provider_id !== "pp_system_default"
          }
          onClick={() => onPick(attempt.reference ?? attempt.session_id)}
        >
          Check
        </Button>
      </div>
    ))}
  </Container>
);

export const config = defineRouteConfig({
  label: "Payment lookup",
  icon: CreditCard,
});

export default PaymentLookupPage;
