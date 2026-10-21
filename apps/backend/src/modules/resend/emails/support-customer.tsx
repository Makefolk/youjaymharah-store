import { Button, Container, Section, Text } from "react-email";

import { EmailLayout } from "./components/layout";
import type { BrandSummary } from "./constants";

export type SupportCustomerEmailProps = {
  /** We got their request, or staff replied to it. */
  event: "received" | "reply";
  reference: string;
  name: string;
  /** What they sent (received), or the reply (reply). */
  message: string;
  /** Their conversation on the website. */
  url: string;
  /** From Settings › Customer support, e.g. "within one working day". */
  response_time?: string | null;
  brand?: BrandSummary;
};

function SupportCustomerEmailComponent({
  event,
  reference,
  name,
  message,
  url,
  response_time,
  brand,
}: SupportCustomerEmailProps) {
  return (
    <EmailLayout
      brand={brand}
      preview={
        event === "received"
          ? `We've got your message (${reference})`
          : `A reply about ${reference}`
      }
      heading={
        event === "received" ? "We've got your message" : "We've replied"
      }
      intro={
        event === "received"
          ? `Thanks, ${name}. Your reference is ${reference}. ${
              response_time
                ? `We usually reply ${response_time}.`
                : "We'll reply as soon as we can."
            }`
          : `Hi ${name}, here's our reply about ${reference}.`
      }
    >
      <Container className="px-6">
        {event === "received" && (
          <Text className="text-gray-600">What you sent:</Text>
        )}
        <Text className="whitespace-pre-wrap text-gray-800">{message}</Text>
        <Section className="my-6 text-center">
          <Button
            href={url}
            className="rounded-lg bg-[#27272a] px-6 py-3 font-semibold text-white"
          >
            {event === "received" ? "Follow your request" : "Reply"}
          </Button>
        </Section>
        <Text className="text-gray-600">
          You can also reply to this email. Keep this link to yourself: it opens
          your conversation with us.
        </Text>
      </Container>
    </EmailLayout>
  );
}

export const supportCustomerEmail = (props: SupportCustomerEmailProps) => (
  <SupportCustomerEmailComponent {...props} />
);

export default function SupportCustomerEmailPreview() {
  return (
    <SupportCustomerEmailComponent
      event="reply"
      reference="SR-7K3Q9P"
      name="Ada"
      message="Sorry about that! We'll collect the shoes tomorrow and send a new pair."
      url="https://example.com/support/sreq_123?access=abc"
    />
  );
}
