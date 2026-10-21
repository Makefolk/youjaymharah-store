import { Container, Section, Text } from "react-email";

import { EmailLayout } from "./components/layout";
import type { BrandSummary } from "./constants";

export type ContactMessageEmailProps = {
  name: string;
  email: string;
  topic?: string | null;
  order_number?: string | null;
  /** Whether the order number belongs to an order placed with this email. */
  order_matched?: boolean;
  message: string;
  brand?: BrandSummary;
};

/** To the support inbox; replying answers the customer. */
function ContactMessageEmailComponent({
  name,
  email,
  topic,
  order_number,
  order_matched,
  message,
  brand,
}: ContactMessageEmailProps) {
  return (
    <EmailLayout
      brand={brand}
      preview={`${name}: ${message.slice(0, 80)}`}
      heading="New message from the contact page"
      intro="Reply to this email to answer the customer directly."
    >
      <Container className="px-6">
        <Section className="my-4">
          <Text className="m-0 text-gray-600">From</Text>
          <Text className="mt-0 font-semibold">{`${name} <${email}>`}</Text>
          {topic && (
            <>
              <Text className="m-0 text-gray-600">About</Text>
              <Text className="mt-0">{topic}</Text>
            </>
          )}
          {order_number && (
            <>
              <Text className="m-0 text-gray-600">Order</Text>
              <Text className="mt-0">
                {`#${order_number} ${
                  order_matched
                    ? "(placed with this email)"
                    : "(no order with this number and email; check before sharing details)"
                }`}
              </Text>
            </>
          )}
        </Section>
        <Text className="whitespace-pre-wrap text-gray-800">{message}</Text>
      </Container>
    </EmailLayout>
  );
}

export const contactMessageEmail = (props: ContactMessageEmailProps) => (
  <ContactMessageEmailComponent {...props} />
);

export type ContactReceivedEmailProps = {
  name: string;
  message: string;
  /** From Settings > Customer support, e.g. "within one working day". */
  response_time?: string | null;
  brand?: BrandSummary;
};

/** To the customer, confirming the message arrived. */
function ContactReceivedEmailComponent({
  name,
  message,
  response_time,
  brand,
}: ContactReceivedEmailProps) {
  return (
    <EmailLayout
      brand={brand}
      preview="We've got your message"
      heading="We've got your message"
      intro={`Thanks, ${name}. ${
        response_time
          ? `We usually reply ${response_time}.`
          : "We'll reply as soon as we can."
      } You can reply to this email to add anything.`}
    >
      <Container className="px-6">
        <Text className="text-gray-600">What you sent:</Text>
        <Text className="whitespace-pre-wrap text-gray-800">{message}</Text>
      </Container>
    </EmailLayout>
  );
}

export const contactReceivedEmail = (props: ContactReceivedEmailProps) => (
  <ContactReceivedEmailComponent {...props} />
);

export default function ContactMessageEmailPreview() {
  return (
    <ContactMessageEmailComponent
      name="Ada Obi"
      email="ada@example.com"
      topic="An order"
      order_number="1042"
      order_matched
      message={"Hello,\nMy order hasn't arrived yet. Could you check?"}
    />
  );
}
