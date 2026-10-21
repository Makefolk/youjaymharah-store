import { Column, Container, Heading, Row, Section, Text } from "react-email";
import type { CustomerDTO, OrderDTO } from "@medusajs/framework/types";

import { formatMoney } from "../utils/format-money";
import { EmailLayout } from "./components/layout";
import { OrderPageButton } from "./components/order-page-button";
import type { BrandSummary } from "./constants";

/**
 * Typed structurally: the sending step assembles this from the received return,
 * and only these fields are read.
 */
export type ReturnReceiptSummary = {
  id?: string;
  display_id?: number | string | null;
  items?: {
    title?: string | null;
    variant_title?: string | null;
    received_quantity?: number | null;
    damaged_quantity?: number | null;
  }[];
  /** What is owed back to the customer for this return, if anything. */
  refund_amount?: number | null;
  /** Set when the return belongs to an exchange or a claim. */
  part_of?: "exchange" | "claim" | null;
};

export type ReturnReceivedEmailProps = {
  order: OrderDTO & { customer?: CustomerDTO };
  /** Named `orderReturn` because `return` is a reserved word. */
  orderReturn: ReturnReceiptSummary;
  /** Live store branding, supplied by the sending step. */
  brand?: BrandSummary;
};

function ReturnReceivedEmailComponent({
  order,
  orderReturn,
  brand,
}: ReturnReceivedEmailProps) {
  const recipient =
    order.customer?.first_name ?? order.shipping_address?.first_name ?? "there";
  // An exchange or claim settles its balance on its own terms (a swap, a
  // replacement), so its return must not promise a refund of its own.
  const refund =
    !orderReturn.part_of &&
    orderReturn.refund_amount &&
    orderReturn.refund_amount > 0
      ? formatMoney(orderReturn.refund_amount, order.currency_code)
      : "";
  const anyDamaged = orderReturn.items?.some(
    (item) => (item.damaged_quantity ?? 0) > 0,
  );

  return (
    <EmailLayout
      brand={brand}
      preview={`We have received your return for order #${order.display_id}`}
      heading={`We have your return, ${recipient}`}
      intro={`Your return for order #${order.display_id} has arrived.`}
    >
      <Container className="px-6">
        <Heading className="mb-4 text-xl font-semibold text-gray-800">
          What we received
        </Heading>
        {orderReturn.items?.map((item, index) => (
          <Row
            key={`${item.title}-${index}`}
            className="border-b border-gray-200 py-3"
          >
            <Column className="w-3/4">
              <Text className="m-0 text-gray-800">{item.title}</Text>
              {item.variant_title && (
                <Text className="m-0 text-sm text-gray-500">
                  {item.variant_title}
                </Text>
              )}
              {(item.damaged_quantity ?? 0) > 0 && (
                <Text className="m-0 text-sm text-gray-500">
                  {item.damaged_quantity} arrived damaged
                </Text>
              )}
            </Column>
            <Column className="w-1/4 text-right">
              <Text className="m-0 text-gray-600">
                x
                {(item.received_quantity ?? 0) + (item.damaged_quantity ?? 0) ||
                  1}
              </Text>
            </Column>
          </Row>
        ))}

        {refund ? (
          <Section className="my-6 rounded-lg bg-gray-50 p-4">
            <Text className="m-0 text-gray-800">
              We will refund <strong>{refund}</strong> to your original payment
              method.
            </Text>
          </Section>
        ) : (
          <Text className="mt-6 text-gray-600">
            If anything is still owed to you, we will let you know once it has
            been issued.
          </Text>
        )}

        {anyDamaged && (
          <Text className="text-gray-600">
            Some items arrived damaged. We will be in touch about those
            separately.
          </Text>
        )}

        <OrderPageButton orderId={order.id} label="View your return" />

        <Text className="mt-6 text-sm text-gray-500">
          Order ID: #{order.display_id}
        </Text>
      </Container>
    </EmailLayout>
  );
}

export const returnReceivedEmail = (props: ReturnReceivedEmailProps) => (
  <ReturnReceivedEmailComponent {...props} />
);

const mockProps = {
  order: {
    id: "order_01JSNXDH9BPJWWKVW03B9E9KW8",
    display_id: 1,
    currency_code: "ngn",
    customer: { first_name: "Ada" },
    shipping_address: { first_name: "Ada" },
  },
  orderReturn: {
    id: "return_01JSNXDH9BPJWWKVW03B9E9KW8",
    display_id: 1,
    items: [
      {
        title: "Relaxed Linen Shirt",
        variant_title: "White / M",
        received_quantity: 1,
        damaged_quantity: 0,
      },
    ],
    refund_amount: 25000,
  },
};

export default function ReturnReceivedEmailPreview() {
  // @ts-ignore -- preview-only mock, not the full OrderDTO
  return <ReturnReceivedEmailComponent {...mockProps} />;
}
