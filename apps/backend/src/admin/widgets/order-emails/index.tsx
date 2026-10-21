import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types";
import {
  Button,
  Container,
  Heading,
  Text,
  toast,
  usePrompt,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  EmailHistoryList,
  type EmailHistoryEntry,
} from "../../components/email-history/email-history-list";
import { RenderFromQuery } from "../../components/render-from-query";
import { sdk } from "../../lib/sdk";
import { usePermissions, withPermission } from "../../lib/permissions";

const orderEmailsQueryKey = (orderId: string) => ["order-emails", orderId];

/**
 * Every email sent about this order and whether it reached the customer, so
 * "I never got my confirmation" can be answered from the order page.
 */
const OrderEmailsWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const queryClient = useQueryClient();
  const prompt = usePrompt();
  const { can } = usePermissions();

  const { data, isLoading, isError } = useQuery({
    queryKey: orderEmailsQueryKey(order.id),
    queryFn: () =>
      sdk.client.fetch<{ emails: EmailHistoryEntry[] }>(
        `/admin/orders/${order.id}/emails`,
      ),
  });

  const resend = useMutation({
    mutationFn: () =>
      sdk.client.fetch<{ sent_to: string | null; pending: boolean }>(
        `/admin/orders/${order.id}/emails/resend-confirmation`,
        { method: "POST" },
      ),
    onSuccess: ({ sent_to, pending }) => {
      void queryClient.invalidateQueries({
        queryKey: orderEmailsQueryKey(order.id),
      });
      if (sent_to) toast.success(`Confirmation sent to ${sent_to}.`);
      else if (pending)
        toast.warning("Resend didn't accept it yet. It will keep retrying.");
      else toast.error("This order has no email address.");
    },
    onError: (error: Error) => toast.error(error.message),
  });

  const confirmResend = async () => {
    const confirmed = await prompt({
      title: "Resend the order confirmation?",
      description: order.email
        ? `It goes to ${order.email}. If that address bounced, correct the order's email first.`
        : "This order has no email address.",
      confirmText: "Resend",
      cancelText: "Cancel",
    });
    if (confirmed) resend.mutate();
  };

  const emails = data?.emails ?? [];

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between px-6 py-4">
        <Heading level="h2">Customer emails</Heading>
        {can("order", "update") ? (
          <Button
            size="small"
            variant="secondary"
            disabled={!order.email || resend.isPending}
            isLoading={resend.isPending}
            onClick={confirmResend}
          >
            Resend confirmation
          </Button>
        ) : null}
      </div>
      <div className="px-6 py-4">
        <RenderFromQuery
          isLoading={isLoading}
          isError={isError}
          isEmpty={!emails.length}
          loading={
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              Loading…
            </Text>
          }
          error={
            <Text size="small" leading="compact" className="text-ui-fg-error">
              Couldn't load this order's emails.
            </Text>
          }
          empty={
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              No emails recorded for this order. Orders placed before email
              tracking began show their emails on the customer's page.
            </Text>
          }
        >
          <EmailHistoryList emails={emails} />
        </RenderFromQuery>
      </div>
    </Container>
  );
};

export const config = defineWidgetConfig({
  zone: "order.details.side",
});

export default withPermission(OrderEmailsWidget, "order", "read");
