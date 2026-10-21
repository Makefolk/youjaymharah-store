import { Container, Section, Text } from "react-email";
import type { CustomerDTO, OrderDTO } from "@medusajs/framework/types";

import { formatMoney } from "../utils/format-money";
import { EmailLayout } from "./components/layout";
import { OrderPageButton } from "./components/order-page-button";
import type { BrandSummary } from "./constants";

/**
 * What the customer is told about a refund. The staff note on a refund is
 * internal and deliberately never passed here; only the reason's label is.
 */
export type RefundSummary = {
  id?: string;
  amount?: number | null;
  currency_code?: string | null;
  /** The refund reason's label, e.g. "Wrong size". */
  reason?: string | null;
};

export type RefundIssuedEmailProps = {
  order: OrderDTO & { customer?: CustomerDTO };
  refund: RefundSummary;
  /** Live store branding, supplied by the sending step. */
  brand?: BrandSummary;
};

function RefundIssuedEmailComponent({
  order,
  refund,
  brand,
}: RefundIssuedEmailProps) {
  const recipient =
    order.customer?.first_name ?? order.shipping_address?.first_name ?? "there";
  const amount = formatMoney(
    refund.amount,
    refund.currency_code ?? order.currency_code,
  );

  return (
    <EmailLayout
      brand={brand}
      preview={
        amount
          ? `Your refund of ${amount} for order #${order.display_id} is on its way`
          : `Your refund for order #${order.display_id} is on its way`
      }
      heading={`Your refund is on its way, ${recipient}`}
      intro={
        amount
          ? `We have refunded ${amount} for order #${order.display_id}.`
          : `We have issued a refund for order #${order.display_id}.`
      }
    >
      <Container className="px-6">
        {(amount || refund.reason) && (
          <Section className="mb-6 rounded-lg bg-gray-50 p-4">
            {amount && (
              <Text className="m-0 text-2xl font-semibold text-gray-800">
                {amount}
              </Text>
            )}
            {refund.reason && (
              <Text className="m-0 mt-2 text-gray-600">
                Reason: {refund.reason}
              </Text>
            )}
          </Section>
        )}

        <Text className="text-gray-600">
          The money goes back to your original payment method. Depending on your
          bank, it can take several working days to appear.
        </Text>

        <OrderPageButton orderId={order.id} />

        <Text className="mt-6 text-sm text-gray-500">
          Order ID: #{order.display_id}
        </Text>
      </Container>
    </EmailLayout>
  );
}

export const refundIssuedEmail = (props: RefundIssuedEmailProps) => (
  <RefundIssuedEmailComponent {...props} />
);

const mockProps = {
  order: {
    id: "order_01JSNXDH9BPJWWKVW03B9E9KW8",
    display_id: 1,
    currency_code: "ngn",
    customer: { first_name: "Ada" },
    shipping_address: { first_name: "Ada" },
  },
  refund: {
    id: "ref_01JSNXDH9BPJWWKVW03B9E9KW8",
    amount: 25000,
    currency_code: "ngn",
    reason: "Wrong size",
  },
};

export default function RefundIssuedEmailPreview() {
  // @ts-ignore -- preview-only mock, not the full OrderDTO
  return <RefundIssuedEmailComponent {...mockProps} />;
}
