import { Column, Container, Heading, Row, Section, Text } from "react-email";
import type { CustomerDTO, OrderDTO } from "@medusajs/framework/types";

import { EmailLayout } from "./components/layout";
import { OrderPageButton } from "./components/order-page-button";
import type { BrandSummary } from "./constants";

/**
 * Typed structurally: the sending step assembles this from the return, its
 * items and the return's stock location, and only these fields are read.
 */
export type ReturnRequestSummary = {
  id?: string;
  display_id?: number | string | null;
  items?: {
    title?: string | null;
    variant_title?: string | null;
    quantity?: number | null;
    reason?: string | null;
  }[];
  /** Where the parcel goes back to; absent when the return has no location. */
  location?: {
    name?: string | null;
    address_lines?: string[];
  } | null;
};

export type ReturnRequestedEmailProps = {
  order: OrderDTO & { customer?: CustomerDTO };
  /** Named `orderReturn` because `return` is a reserved word. */
  orderReturn: ReturnRequestSummary;
  /** Live store branding, supplied by the sending step. */
  brand?: BrandSummary;
};

function ReturnRequestedEmailComponent({
  order,
  orderReturn,
  brand,
}: ReturnRequestedEmailProps) {
  const recipient =
    order.customer?.first_name ?? order.shipping_address?.first_name ?? "there";
  const location = orderReturn.location;
  const addressLines = location?.address_lines?.filter(Boolean) ?? [];
  const hasDestination = Boolean(location?.name || addressLines.length);

  return (
    <EmailLayout
      brand={brand}
      preview={`Your return for order #${order.display_id} is booked`}
      heading={`Your return is booked, ${recipient}`}
      intro={`We have set up a return for order #${order.display_id}.`}
    >
      <Container className="px-6">
        <Heading className="mb-4 text-xl font-semibold text-gray-800">
          Items to send back
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
              {item.reason && (
                <Text className="m-0 text-sm text-gray-500">
                  Reason: {item.reason}
                </Text>
              )}
            </Column>
            <Column className="w-1/4 text-right">
              <Text className="m-0 text-gray-600">x{item.quantity ?? 1}</Text>
            </Column>
          </Row>
        ))}

        {hasDestination ? (
          <Section className="my-6 rounded-lg bg-gray-50 p-4">
            <Heading className="m-0 text-base font-semibold text-gray-800">
              Where to send it
            </Heading>
            {location?.name && (
              <Text className="m-0 mt-2 text-gray-800">{location.name}</Text>
            )}
            {addressLines.map((line) => (
              <Text key={line} className="m-0 text-gray-600">
                {line}
              </Text>
            ))}
          </Section>
        ) : (
          <Text className="mt-6 text-gray-600">
            We will be in touch with how to send the items back.
          </Text>
        )}

        <Text className="text-gray-600">
          Pack the items securely and include your order number, #
          {order.display_id}. We will email you when they arrive.
        </Text>

        <OrderPageButton orderId={order.id} label="View your return" />

        <Text className="mt-6 text-sm text-gray-500">
          Order ID: #{order.display_id}
        </Text>
      </Container>
    </EmailLayout>
  );
}

export const returnRequestedEmail = (props: ReturnRequestedEmailProps) => (
  <ReturnRequestedEmailComponent {...props} />
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
        quantity: 1,
        reason: "Wrong size",
      },
    ],
    location: {
      name: "Lagos Warehouse",
      address_lines: ["12 Admiralty Way", "Lekki, Lagos", "NG"],
    },
  },
};

export default function ReturnRequestedEmailPreview() {
  // @ts-ignore -- preview-only mock, not the full OrderDTO
  return <ReturnRequestedEmailComponent {...mockProps} />;
}
