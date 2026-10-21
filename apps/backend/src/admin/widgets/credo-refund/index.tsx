import { defineWidgetConfig } from "@medusajs/admin-sdk";
import type { AdminOrder, DetailWidgetProps } from "@medusajs/framework/types";
import {
  Button,
  Container,
  Drawer,
  Heading,
  Input,
  Label,
  Select,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { sdk } from "../../lib/sdk";
import { usePermissions, withPermission } from "../../lib/permissions";

const CREDO_PROVIDER_ID = "pp_credo_credo";

type Payment = {
  id: string;
  provider_id: string;
  amount: number;
  currency_code: string;
  captures?: { amount: number }[];
  refunds?: { amount: number }[];
};

const sum = (rows: { amount: number }[] | undefined) =>
  (rows ?? []).reduce((total, row) => total + Number(row.amount), 0);

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

/**
 * Credo has no refund API: staff refund in the Credo dashboard, then record
 * it here so the order, its balance and the customer's refund email match.
 * Shown only for orders paid with Credo.
 */
const CredoRefundWidget = ({ data: order }: DetailWidgetProps<AdminOrder>) => {
  const { can } = usePermissions();
  const [open, setOpen] = useState(false);

  const payments = useQuery({
    queryKey: ["credo-payments", order.id],
    queryFn: async () => {
      const { order: withPayments } = await sdk.admin.order.retrieve(order.id, {
        fields:
          "id,*payment_collections.payments,*payment_collections.payments.captures,*payment_collections.payments.refunds",
      });
      return (withPayments.payment_collections ?? [])
        .flatMap((collection) => collection.payments ?? [])
        .filter(
          (payment) => payment.provider_id === CREDO_PROVIDER_ID,
        ) as unknown as Payment[];
    },
  });

  const credo = (payments.data ?? []).map((payment) => ({
    ...payment,
    refundable: sum(payment.captures) - sum(payment.refunds),
  }));
  if (!credo.length) return null;

  return (
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-x-4 px-6 py-4">
        <Heading level="h2">Credo refund</Heading>
        {can("refund", "create") && (
          <Button
            size="small"
            variant="secondary"
            disabled={!credo.some((payment) => payment.refundable > 0)}
            onClick={() => setOpen(true)}
          >
            Record refund
          </Button>
        )}
      </div>
      <div className="flex flex-col gap-y-2 px-6 py-4">
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          Credo refunds are made in the Credo dashboard. After refunding there,
          record it here with Credo's reference: the order and its balance
          update, and the customer gets the refund email.
        </Text>
        {credo.map((payment) => (
          <Text key={payment.id} size="small" leading="compact">
            {money(payment.refundable, payment.currency_code)} left to refund of{" "}
            {money(Number(payment.amount), payment.currency_code)}
          </Text>
        ))}
      </div>
      {open && (
        <RecordDrawer
          orderId={order.id}
          payments={credo}
          onClose={() => setOpen(false)}
        />
      )}
    </Container>
  );
};

const RecordDrawer = ({
  orderId,
  payments,
  onClose,
}: {
  orderId: string;
  payments: (Payment & { refundable: number })[];
  onClose: () => void;
}) => {
  const queryClient = useQueryClient();
  const refundable = payments.filter((payment) => payment.refundable > 0);
  const [paymentId, setPaymentId] = useState(refundable[0]?.id ?? "");
  const payment = refundable.find((entry) => entry.id === paymentId);
  const [amount, setAmount] = useState(
    payment ? String(payment.refundable) : "",
  );
  const [reference, setReference] = useState("");
  const [reasonId, setReasonId] = useState("");
  const [note, setNote] = useState("");

  const reasons = useQuery({
    queryKey: ["refund-reasons"],
    queryFn: () => sdk.admin.refundReason.list({ limit: 100 }),
  });

  const parsed = Number(amount);
  const valid =
    Boolean(payment) &&
    parsed > 0 &&
    parsed <= (payment?.refundable ?? 0) &&
    reference.trim().length >= 3;

  const save = useMutation({
    mutationFn: () =>
      sdk.client.fetch(`/admin/orders/${orderId}/credo-refunds`, {
        method: "POST",
        body: {
          payment_id: paymentId,
          amount: parsed,
          reference: reference.trim(),
          refund_reason_id: reasonId || null,
          note: note.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success("Refund recorded. The customer has been emailed.");
      void queryClient.invalidateQueries({ queryKey: ["credo-payments"] });
      // Medusa's own order queries, so its Payments section shows the refund.
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      onClose();
    },
    onError: (error: Error) => toast.error(error.message),
  });

  return (
    <Drawer open onOpenChange={(open) => !open && onClose()}>
      <Drawer.Content>
        <Drawer.Header>
          <Drawer.Title>Record a Credo refund</Drawer.Title>
        </Drawer.Header>
        <Drawer.Body className="flex flex-col gap-5 overflow-y-auto">
          <Text size="small" className="text-ui-fg-subtle">
            Only after the refund shows as done in the Credo dashboard. This
            records it; it doesn't send any money.
          </Text>
          {refundable.length > 1 && (
            <div className="flex flex-col gap-y-2">
              <Label size="small" weight="plus">
                Payment
              </Label>
              <Select value={paymentId} onValueChange={setPaymentId}>
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Content>
                  {refundable.map((entry) => (
                    <Select.Item key={entry.id} value={entry.id}>
                      {money(Number(entry.amount), entry.currency_code)} (
                      {money(entry.refundable, entry.currency_code)} left)
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select>
            </div>
          )}
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="credo-amount" size="small" weight="plus">
              Amount refunded
            </Label>
            <Input
              id="credo-amount"
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
            {payment && (
              <Text
                size="small"
                leading="compact"
                className="text-ui-fg-subtle"
              >
                Up to {money(payment.refundable, payment.currency_code)}.
              </Text>
            )}
          </div>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="credo-reference" size="small" weight="plus">
              Credo refund reference
            </Label>
            <Input
              id="credo-reference"
              value={reference}
              onChange={(event) => setReference(event.target.value)}
            />
          </div>
          <div className="flex flex-col gap-y-2">
            <Label size="small" weight="plus">
              Reason (shown to the customer)
            </Label>
            <Select value={reasonId} onValueChange={setReasonId}>
              <Select.Trigger>
                <Select.Value placeholder="No reason" />
              </Select.Trigger>
              <Select.Content>
                {(reasons.data?.refund_reasons ?? []).map((reason) => (
                  <Select.Item key={reason.id} value={reason.id}>
                    {reason.label}
                  </Select.Item>
                ))}
              </Select.Content>
            </Select>
          </div>
          <div className="flex flex-col gap-y-2">
            <Label htmlFor="credo-note" size="small" weight="plus">
              Note (staff only)
            </Label>
            <Textarea
              id="credo-note"
              rows={3}
              maxLength={500}
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
            disabled={!valid}
            onClick={() => save.mutate()}
          >
            Record refund
          </Button>
        </Drawer.Footer>
      </Drawer.Content>
    </Drawer>
  );
};

export const config = defineWidgetConfig({
  zone: "order.details.side",
});

export default withPermission(CredoRefundWidget, "order", "read");
