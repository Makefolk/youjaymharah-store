import { Container, Text } from "react-email";
import type { CustomerDTO, OrderDTO } from "@medusajs/framework/types";

import { BalanceNotice } from "./components/balance-notice";
import { type EmailLineItem, ItemList } from "./components/item-list";
import { EmailLayout } from "./components/layout";
import { OrderPageButton } from "./components/order-page-button";
import {
  type ReturnDestination,
  ReturnDestinationSection,
} from "./components/return-destination";
import type { BrandSummary } from "./constants";

/**
 * Typed structurally: the sending step assembles this from the exchange, its
 * return and the return's stock location, and only these fields are read.
 */
export type ExchangeSummary = {
  id?: string;
  display_id?: number | string | null;
  /** Items the store sends out. */
  new_items?: EmailLineItem[];
  /** Items the customer sends back. */
  return_items?: EmailLineItem[];
  location?: ReturnDestination | null;
  /** The order summary's `pending_difference` once the exchange is confirmed. */
  pending_difference?: number | null;
};

export type ExchangeCreatedEmailProps = {
  order: OrderDTO & { customer?: CustomerDTO };
  exchange: ExchangeSummary;
  /** Live store branding, supplied by the sending step. */
  brand?: BrandSummary;
};

function ExchangeCreatedEmailComponent({
  order,
  exchange,
  brand,
}: ExchangeCreatedEmailProps) {
  const recipient =
    order.customer?.first_name ?? order.shipping_address?.first_name ?? "there";
  const hasNewItems = Boolean(exchange.new_items?.length);
  const hasReturnItems = Boolean(exchange.return_items?.length);

  return (
    <EmailLayout
      brand={brand}
      preview={`Your exchange for order #${order.display_id} is confirmed`}
      heading={`Your exchange is confirmed, ${recipient}`}
      intro={`We have set up an exchange on order #${order.display_id}.`}
    >
      <Container className="px-6">
        <ItemList heading="On its way to you" items={exchange.new_items} />
        {hasNewItems && (
          <Text className="mt-4 text-gray-600">
            We will email you when it ships.
          </Text>
        )}

        <ItemList heading="Please send back" items={exchange.return_items} />
        {hasReturnItems && (
          <>
            <ReturnDestinationSection destination={exchange.location} />
            <Text className="text-gray-600">
              Pack the items securely and include your order number, #
              {order.display_id}.
            </Text>
          </>
        )}

        <BalanceNotice
          pendingDifference={exchange.pending_difference}
          currencyCode={order.currency_code}
        />

        <OrderPageButton orderId={order.id} />

        <Text className="mt-6 text-sm text-gray-500">
          Order ID: #{order.display_id}
        </Text>
      </Container>
    </EmailLayout>
  );
}

export const exchangeCreatedEmail = (props: ExchangeCreatedEmailProps) => (
  <ExchangeCreatedEmailComponent {...props} />
);

const mockProps = {
  order: {
    id: "order_01JSNXDH9BPJWWKVW03B9E9KW8",
    display_id: 1,
    currency_code: "ngn",
    customer: { first_name: "Ada" },
    shipping_address: { first_name: "Ada" },
  },
  exchange: {
    id: "oexc_01JSNXDH9BPJWWKVW03B9E9KW8",
    display_id: 1,
    new_items: [
      { title: "Relaxed Linen Shirt", variant_title: "White / L", quantity: 1 },
    ],
    return_items: [
      { title: "Relaxed Linen Shirt", variant_title: "White / M", quantity: 1 },
    ],
    location: {
      name: "Lagos Warehouse",
      address_lines: ["12 Admiralty Way", "Lekki, Lagos", "NG"],
    },
    pending_difference: 0,
  },
};

export default function ExchangeCreatedEmailPreview() {
  // @ts-ignore -- preview-only mock, not the full OrderDTO
  return <ExchangeCreatedEmailComponent {...mockProps} />;
}
