import { Button, Container, Section, Text } from "react-email";

import { EmailLayout } from "./components/layout";
import type { BrandSummary } from "./constants";

export type SupportStaffEmailProps = {
  /** A new request, or the customer's reply on an existing one. */
  event: "new" | "reply";
  reference: string;
  kind_label: string;
  name: string;
  email: string;
  order_number?: number | null;
  /** For contact-page requests: whether the order number matched their email. */
  order_matched?: boolean | null;
  message: string;
  /**
   * How many photos came with the message. They are private, so the email
   * says so rather than linking them; staff see them in the inbox.
   */
  photo_count?: number;
  admin_url: string;
  brand?: BrandSummary;
};

/** To the support inbox; replying by email answers the customer directly. */
function SupportStaffEmailComponent(props: SupportStaffEmailProps) {
  const {
    event,
    reference,
    kind_label,
    name,
    email,
    order_number,
    order_matched,
    message,
    photo_count = 0,
    admin_url,
    brand,
  } = props;

  return (
    <EmailLayout
      brand={brand}
      preview={`${reference} · ${name}: ${message.slice(0, 80)}`}
      heading={
        event === "new"
          ? `New request ${reference}`
          : `${name} replied on ${reference}`
      }
      intro="Answer in Support inbox so the conversation stays in one place, or reply to this email."
    >
      <Container className="px-6">
        <Section className="my-4">
          <Text className="m-0 text-gray-600">From</Text>
          <Text className="mt-0 font-semibold">{`${name} <${email}>`}</Text>
          <Text className="m-0 text-gray-600">About</Text>
          <Text className="mt-0">{kind_label}</Text>
          {order_number ? (
            <>
              <Text className="m-0 text-gray-600">Order</Text>
              <Text className="mt-0">
                {`#${order_number}${
                  order_matched === false
                    ? " (no order with this number and email; check before sharing details)"
                    : ""
                }`}
              </Text>
            </>
          ) : null}
        </Section>
        <Text className="whitespace-pre-wrap text-gray-800">{message}</Text>
        {photo_count > 0 && (
          <Text className="text-gray-600">
            {photo_count === 1
              ? "1 photo attached. Open the request to see it."
              : `${photo_count} photos attached. Open the request to see them.`}
          </Text>
        )}
        <Section className="my-6 text-center">
          <Button
            href={admin_url}
            className="rounded-lg bg-[#27272a] px-6 py-3 font-semibold text-white"
          >
            Open in Support inbox
          </Button>
        </Section>
      </Container>
    </EmailLayout>
  );
}

export const supportStaffEmail = (props: SupportStaffEmailProps) => (
  <SupportStaffEmailComponent {...props} />
);

export default function SupportStaffEmailPreview() {
  return (
    <SupportStaffEmailComponent
      event="new"
      reference="SR-7K3Q9P"
      kind_label="Damaged or faulty item"
      name="Ada Obi"
      email="ada@example.com"
      order_number={1042}
      message={"The heel came loose on the first wear."}
      photo_count={2}
      admin_url="https://admin.example.com/support-inbox/sreq_123"
    />
  );
}
