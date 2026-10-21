import { Column, Container, Row, Text } from "react-email";
import type { CustomerDTO, OrderDTO } from "@medusajs/framework/types";

import { formatMoney } from "../utils/format-money";
import { BalanceNotice } from "./components/balance-notice";
import { type EmailLineItem, ItemList } from "./components/item-list";
import { EmailLayout } from "./components/layout";
import { OrderPageButton } from "./components/order-page-button";
import type { BrandSummary } from "./constants";

/**
 * The order as it stands after an edit. Deliberately the result rather than a
 * list of changes: the edit's actions describe internal steps (and can carry
 * staff notes), while the customer only needs to know what they will receive
 * and what it costs now.
 */
export type OrderUpdateSummary = {
  items?: EmailLineItem[];
  /** The order total after the edit. */
  total?: number | null;
  /** The order summary's `pending_difference` after the edit. */
  pending_difference?: number | null;
};

export type OrderUpdatedEmailProps = {
  order: OrderDTO & { customer?: CustomerDTO };
  update: OrderUpdateSummary;
  /** Live store branding, supplied by the sending step. */
  brand?: BrandSummary;
};

function OrderUpdatedEmailComponent({
  order,
  update,
  brand,
}: OrderUpdatedEmailProps) {
  const recipient =
    order.customer?.first_name ?? order.shipping_address?.first_name ?? "there";
  const total = formatMoney(update.total, order.currency_code);

  return (
    <EmailLayout
      brand={brand}
      preview={`Order #${order.display_id} has been updated`}
      heading={`Your order has been updated, ${recipient}`}
      intro={`We have made changes to order #${order.display_id}. This is how it looks now.`}
    >
      <Container className="px-6">
        <ItemList heading="Your items" items={update.items} />

        {total && (
          <Row className="mt-4 border-t border-gray-200 font-bold text-gray-800">
            <Column className="w-1/2">
              <Text>New total</Text>
            </Column>
            <Column className="w-1/2 text-right">
              <Text>{total}</Text>
            </Column>
          </Row>
        )}

        <BalanceNotice
          pendingDifference={update.pending_difference}
          currencyCode={order.currency_code}
        />

        <Text className="mt-6 text-gray-600">
          Did not ask for this change? Reply to this email and we will put it
          right.
        </Text>

        <OrderPageButton orderId={order.id} />

        <Text className="mt-6 text-sm text-gray-500">
          Order ID: #{order.display_id}
        </Text>
      </Container>
    </EmailLayout>
  );
}

export const orderUpdatedEmail = (props: OrderUpdatedEmailProps) => (
  <OrderUpdatedEmailComponent {...props} />
);

const mockProps = {
  order: {
    id: "order_01JSNXDH9BPJWWKVW03B9E9KW8",
    display_id: 1,
    currency_code: "ngn",
    customer: { first_name: "Ada" },
    shipping_address: { first_name: "Ada" },
  },
  update: {
    items: [
      { title: "Relaxed Linen Shirt", variant_title: "White / L", quantity: 1 },
      { title: "Wide-Leg Trousers", variant_title: "Black / 10", quantity: 1 },
    ],
    total: 57500,
    pending_difference: 30000,
  },
};

export default function OrderUpdatedEmailPreview() {
  // @ts-ignore -- preview-only mock, not the full OrderDTO
  return <OrderUpdatedEmailComponent {...mockProps} />;
}
