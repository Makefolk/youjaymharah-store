import {
  Column,
  Container,
  Heading,
  Img,
  Link,
  Row,
  Section,
  Text,
} from "react-email";
import type {
  BigNumberValue,
  CustomerDTO,
  OrderDTO,
} from "@medusajs/framework/types";

import { EmailLayout } from "./components/layout";
import { OrderPageButton } from "./components/order-page-button";
import type { BrandSummary } from "./constants";

export type OrderPlacedEmailProps = {
  order: OrderDTO & {
    customer?: CustomerDTO;
  };
  email_banner?: {
    body: string;
    title: string;
    url: string;
  };
  /** Live store branding, supplied by the sending subscriber. */
  brand?: BrandSummary;
};

function OrderPlacedEmailComponent({
  order,
  email_banner,
  brand,
}: OrderPlacedEmailProps) {
  const shouldDisplayBanner = email_banner && "title" in email_banner;

  const recipient =
    order.customer?.first_name ?? order.shipping_address?.first_name ?? "there";

  const formatter = new Intl.NumberFormat([], {
    style: "currency",
    currencyDisplay: "narrowSymbol",
    currency: order.currency_code,
  });

  const formatPrice = (price: BigNumberValue) => {
    if (typeof price === "number") {
      return formatter.format(price);
    }

    if (typeof price === "string") {
      return formatter.format(Number.parseFloat(price));
    }

    return price?.toString() || "";
  };

  return (
    <EmailLayout
      brand={brand}
      preview={`Your order #${order.display_id} is confirmed`}
      heading={`Thank you for your order, ${recipient}`}
      intro="We are processing your order and will let you know as soon as it ships."
    >
      {shouldDisplayBanner && (
        <Container
          className="mb-4 rounded-lg p-7"
          style={{ background: "linear-gradient(to right, #3b82f6, #4f46e5)" }}
        >
          <Section>
            <Row>
              <Column align="left">
                <Heading className="text-xl font-semibold text-white">
                  {email_banner.title}
                </Heading>
                <Text className="mt-2 text-white">{email_banner.body}</Text>
              </Column>
              <Column align="right">
                <Link
                  href={email_banner.url}
                  className="px-2 font-semibold text-white underline"
                >
                  Shop Now
                </Link>
              </Column>
            </Row>
          </Section>
        </Container>
      )}

      <Container className="px-6">
        <OrderPageButton orderId={order.id} label="Track your order" />
      </Container>

      <Container className="px-6">
        <Heading className="mb-4 text-xl font-semibold text-gray-800">
          Your Items
        </Heading>
        <Row>
          <Column>
            <Text className="m-0 my-2 text-sm text-gray-500">
              Order ID: #{order.display_id}
            </Text>
          </Column>
        </Row>
        {order.items?.map((item) => (
          <Section key={item.id} className="border-b border-gray-200 py-4">
            <Row>
              <Column className="w-1/3">
                <Img
                  src={item.thumbnail ?? ""}
                  alt={item.product_title ?? ""}
                  className="rounded-lg"
                  width="100%"
                />
              </Column>
              <Column className="w-2/3 pl-4">
                <Text className="text-lg font-semibold text-gray-800">
                  {item.product_title}
                </Text>
                <Text className="text-gray-600">{item.variant_title}</Text>
                <Text className="mt-2 font-bold text-gray-800">
                  {formatPrice(item.subtotal)}
                </Text>
              </Column>
            </Row>
          </Section>
        ))}

        <Section className="mt-8">
          <Heading className="mb-4 text-xl font-semibold text-gray-800">
            Order Summary
          </Heading>
          {/*
            Every line above Total is tax-exclusive and pre-discount (the same
            fields the storefront's cart totals use), so the column adds up:
            subtotal + shipping - discount + tax = total. `item_total` is not
            usable here -- it already includes tax and discounts, which made
            the separate Tax line count VAT twice.
          */}
          <Row className="text-gray-600">
            <Column className="w-1/2">
              <Text className="m-0">Subtotal</Text>
            </Column>
            <Column className="w-1/2 text-right">
              <Text className="m-0">{formatPrice(order.item_subtotal)}</Text>
            </Column>
          </Row>
          {order.shipping_methods?.map((method) => (
            <Row className="text-gray-600" key={method.id}>
              <Column className="w-1/2">
                <Text className="m-0">{method.name}</Text>
              </Column>
              <Column className="w-1/2 text-right">
                <Text className="m-0">{formatPrice(method.subtotal)}</Text>
              </Column>
            </Row>
          ))}
          {Number(order.discount_subtotal) > 0 && (
            <Row className="text-gray-600">
              <Column className="w-1/2">
                <Text className="m-0">Discount</Text>
              </Column>
              <Column className="w-1/2 text-right">
                <Text className="m-0">
                  -{formatPrice(order.discount_subtotal)}
                </Text>
              </Column>
            </Row>
          )}
          <Row className="text-gray-600">
            <Column className="w-1/2">
              <Text className="m-0">Tax</Text>
            </Column>
            <Column className="w-1/2 text-right">
              <Text className="m-0">{formatPrice(order.tax_total || 0)}</Text>
            </Column>
          </Row>
          <Row className="mt-4 border-t border-gray-200 font-bold text-gray-800">
            <Column className="w-1/2">
              <Text>Total</Text>
            </Column>
            <Column className="w-1/2 text-right">
              <Text>{formatPrice(order.total)}</Text>
            </Column>
          </Row>
        </Section>

        <Text className="mt-6 text-center text-xs text-gray-400">
          Order reference: {order.id}
        </Text>
      </Container>
    </EmailLayout>
  );
}

export const orderPlacedEmail = (props: OrderPlacedEmailProps) => (
  <OrderPlacedEmailComponent {...props} />
);

const mockProps = {
  order: {
    id: "order_01JSNXDH9BPJWWKVW03B9E9KW8",
    display_id: 42,
    email: "ada@example.com",
    currency_code: "ngn",
    // 27,500 + 5,000 shipping - 2,750 discount = 29,750; 7.5% VAT = 2,231.25
    total: 31981.25,
    subtotal: 27500,
    discount_subtotal: 2750,
    shipping_subtotal: 5000,
    tax_total: 2231.25,
    item_subtotal: 27500,
    customer: { first_name: "Ada", last_name: "Obi", email: "ada@example.com" },
    shipping_address: { first_name: "Ada", last_name: "Obi" },
    items: [
      {
        id: "ordli_01JSNXDH9C47KZ43WQ3TBFXZA9",
        product_title: "Medusa Sweatshirt",
        variant_title: "L",
        thumbnail:
          "https://medusa-public-images.s3.eu-west-1.amazonaws.com/sweatshirt-vintage-front.png",
        quantity: 1,
        subtotal: 27500,
      },
    ],
    shipping_methods: [
      {
        id: "ordsm_01JSNXDH9B9DDRQXJT5J5AE5V1",
        name: "Standard Shipping",
        subtotal: 5000,
      },
    ],
  },
};

export default function OrderPlacedEmailPreview() {
  // @ts-ignore -- preview-only mock, not the full OrderDTO
  return <OrderPlacedEmailComponent {...mockProps} />;
}
