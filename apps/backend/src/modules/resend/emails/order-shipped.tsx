import {
  Column,
  Container,
  Heading,
  Link,
  Row,
  Section,
  Text,
} from "react-email";
import type { CustomerDTO, OrderDTO } from "@medusajs/framework/types";

import { EmailLayout } from "./components/layout";
import { OrderPageButton } from "./components/order-page-button";
import type { BrandSummary } from "./constants";

/**
 * Tracking details are typed structurally rather than against FulfillmentDTO:
 * the subscriber assembles this from the fulfillment's labels, and only these
 * fields are ever read.
 */
export type ShipmentSummary = {
  id?: string;
  tracking_numbers?: string[];
  tracking_links?: { url?: string | null; tracking_number?: string | null }[];
  items?: { title?: string | null; quantity?: number | null }[];
};

export type OrderShippedEmailProps = {
  order: OrderDTO & { customer?: CustomerDTO };
  shipment?: ShipmentSummary;
  /** Live store branding, supplied by the sending subscriber. */
  brand?: BrandSummary;
};

function OrderShippedEmailComponent({
  order,
  shipment,
  brand,
}: OrderShippedEmailProps) {
  const recipient =
    order.customer?.first_name ?? order.shipping_address?.first_name ?? "there";

  const trackingLinks = shipment?.tracking_links?.filter((link) => link.url);
  const trackingNumbers =
    shipment?.tracking_numbers?.filter(Boolean) ??
    shipment?.tracking_links
      ?.map((link) => link.tracking_number)
      .filter((value): value is string => Boolean(value)) ??
    [];

  const shippedItems = shipment?.items?.length
    ? shipment.items
    : order.items?.map((item) => ({
        title: item.product_title,
        quantity: item.quantity as number,
      }));

  return (
    <EmailLayout
      brand={brand}
      preview={`Order #${order.display_id} is on its way`}
      heading={`Your order is on its way, ${recipient}`}
      intro={`Order #${order.display_id} has shipped.`}
    >
      <Container className="px-6">
        {trackingNumbers.length > 0 && (
          <Section className="mb-6 rounded-lg bg-gray-50 p-4">
            <Heading className="m-0 text-base font-semibold text-gray-800">
              Tracking
            </Heading>
            {trackingNumbers.map((number) => (
              <Text key={number} className="m-0 mt-2 text-gray-600">
                {number}
              </Text>
            ))}
            {trackingLinks?.map((link) => (
              <Text key={link.url} className="m-0 mt-2">
                <Link
                  href={link.url as string}
                  className="text-blue-600 underline"
                >
                  Track this shipment
                </Link>
              </Text>
            ))}
          </Section>
        )}

        <Heading className="mb-4 text-xl font-semibold text-gray-800">
          What shipped
        </Heading>
        {shippedItems?.map((item, index) => (
          <Row
            key={`${item.title}-${index}`}
            className="border-b border-gray-200 py-3"
          >
            <Column className="w-3/4">
              <Text className="m-0 text-gray-800">{item.title}</Text>
            </Column>
            <Column className="w-1/4 text-right">
              <Text className="m-0 text-gray-600">x{item.quantity ?? 1}</Text>
            </Column>
          </Row>
        ))}

        <OrderPageButton orderId={order.id} label="Track your order" />

        <Text className="mt-6 text-sm text-gray-500">
          Order ID: #{order.display_id}
        </Text>
      </Container>
    </EmailLayout>
  );
}

export const orderShippedEmail = (props: OrderShippedEmailProps) => (
  <OrderShippedEmailComponent {...props} />
);

const mockProps = {
  order: {
    id: "order_01JSNXDH9BPJWWKVW03B9E9KW8",
    display_id: 1,
    currency_code: "ngn",
    customer: { first_name: "Ada" },
    shipping_address: { first_name: "Ada" },
    items: [{ product_title: "Medusa Sweatshirt", quantity: 1 }],
  },
  shipment: {
    id: "ful_01JSNXDH9BPJWWKVW03B9E9KW8",
    tracking_numbers: ["NG1234567890"],
    tracking_links: [{ url: "https://example.com/track/NG1234567890" }],
    items: [{ title: "Medusa Sweatshirt", quantity: 1 }],
  },
};

export default function OrderShippedEmailPreview() {
  // @ts-ignore -- preview-only mock, not the full OrderDTO
  return <OrderShippedEmailComponent {...mockProps} />;
}
