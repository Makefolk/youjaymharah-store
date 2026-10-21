import { Button, Container, Section, Text } from "react-email";

import { EmailLayout } from "./components/layout";
import type { BrandSummary } from "./constants";

export type ReturnAccessEmailProps = {
  /** Fully-formed return link. The sending step builds it from the token. */
  url: string;
  order_number?: string | number | null;
  /** Live store branding, supplied by the sending step. */
  brand?: BrandSummary;
};

function ReturnAccessEmailComponent({
  url,
  order_number,
  brand,
}: ReturnAccessEmailProps) {
  const order = order_number ? `order #${order_number}` : "your order";

  return (
    <EmailLayout
      brand={brand}
      preview={`Your link to return items from ${order}`}
      heading="Return items"
      intro={`Use this link to choose what you'd like to return from ${order}.`}
    >
      <Container className="px-6">
        <Section className="my-6 text-center">
          <Button
            href={url}
            className="rounded-lg bg-[#27272a] px-6 py-3 font-semibold text-white"
          >
            Start a return
          </Button>
        </Section>

        <Text className="text-gray-600">
          The link works for 24 hours. If the button does not work, paste this
          address into your browser:
        </Text>
        <Text className="text-sm break-all text-blue-600">{url}</Text>

        <Text className="mt-6 text-gray-600">
          If you didn&apos;t ask to return anything, you can ignore this email;
          nothing changes until the form is sent.
        </Text>
      </Container>
    </EmailLayout>
  );
}

export const returnAccessEmail = (props: ReturnAccessEmailProps) => (
  <ReturnAccessEmailComponent {...props} />
);

export default function ReturnAccessEmailPreview() {
  return (
    <ReturnAccessEmailComponent
      url="https://example.com/orders/order_123/return?access=abc"
      order_number={1042}
    />
  );
}
