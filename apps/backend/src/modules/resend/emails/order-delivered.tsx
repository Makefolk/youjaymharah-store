import { Column, Container, Heading, Row, Text } from "react-email";
import type { CustomerDTO, OrderDTO } from "@medusajs/framework/types";

import { EmailLayout } from "./components/layout";
import { OrderPageButton } from "./components/order-page-button";
import type { BrandSummary } from "./constants";
import { SUPPORT_EMAIL } from "./constants";

/**
 * Typed structurally rather than against FulfillmentDTO: the sending step
 * assembles this from the delivered fulfillment, and only these fields are read.
 */
export type DeliverySummary = {
  id?: string;
  delivered_at?: string | Date | null;
  items?: { title?: string | null; quantity?: number | null }[];
};

export type OrderDeliveredEmailProps = {
  order: OrderDTO & { customer?: CustomerDTO };
  delivery?: DeliverySummary;
  /** Live store branding, supplied by the sending step. */
  brand?: BrandSummary;
};

function OrderDeliveredEmailComponent({
  order,
  delivery,
  brand,
}: OrderDeliveredEmailProps) {
  const recipient =
    order.customer?.first_name ?? order.shipping_address?.first_name ?? "there";
  const supportEmail = brand?.support_email || SUPPORT_EMAIL;

  const deliveredItems = delivery?.items?.length
    ? delivery.items
    : order.items?.map((item) => ({
        title: item.product_title,
        quantity: item.quantity as number,
      }));

  return (
    <EmailLayout
      brand={brand}
      preview={`Order #${order.display_id} has been delivered`}
      heading={`Your order has arrived, ${recipient}`}
      intro={`Order #${order.display_id} was delivered.`}
    >
      <Container className="px-6">
        <Heading className="mb-4 text-xl font-semibold text-gray-800">
          What was delivered
        </Heading>
        {deliveredItems?.map((item, index) => (
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

        <Text className="mt-6 text-gray-600">
          Something missing, damaged or not quite right? Reply to this email or
          write to {supportEmail} and we will sort it out. To send something
          back, request a return from your order page.
        </Text>

        <OrderPageButton orderId={order.id} />

        <Text className="mt-6 text-sm text-gray-500">
          Order ID: #{order.display_id}
        </Text>
      </Container>
    </EmailLayout>
  );
}

export const orderDeliveredEmail = (props: OrderDeliveredEmailProps) => (
  <OrderDeliveredEmailComponent {...props} />
);

const mockProps = {
  order: {
    id: "order_01JSNXDH9BPJWWKVW03B9E9KW8",
    display_id: 1,
    currency_code: "ngn",
    customer: { first_name: "Ada" },
    shipping_address: { first_name: "Ada" },
    items: [{ product_title: "Relaxed Linen Shirt", quantity: 1 }],
  },
  delivery: {
    id: "ful_01JSNXDH9BPJWWKVW03B9E9KW8",
    delivered_at: "2026-09-13T10:00:00.000Z",
    items: [{ title: "Relaxed Linen Shirt", quantity: 1 }],
  },
};

export default function OrderDeliveredEmailPreview() {
  // @ts-ignore -- preview-only mock, not the full OrderDTO
  return <OrderDeliveredEmailComponent {...mockProps} />;
}
