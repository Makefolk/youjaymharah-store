import { Container, Section, Text } from "react-email";
import type { CustomerDTO, OrderDTO } from "@medusajs/framework/types";

import { describeOrderBalance } from "../utils/order-balance";
import { formatMoney } from "../utils/format-money";
import { BalanceNotice } from "./components/balance-notice";
import { type EmailLineItem, ItemList } from "./components/item-list";
import { EmailLayout } from "./components/layout";
import { OrderPageButton } from "./components/order-page-button";
import {
  type ReturnDestination,
  ReturnDestinationSection,
} from "./components/return-destination";
import type { BrandSummary } from "./constants";

/** Customer-facing wording for Medusa's ClaimReason values. */
const CLAIM_REASON_LABELS: Record<string, string> = {
  missing_item: "Missing item",
  wrong_item: "Wrong item sent",
  production_failure: "Damaged or faulty",
  other: "Other",
};

/**
 * Typed structurally: the sending step assembles this from the claim, its items,
 * its return and the return's stock location, and only these fields are read.
 */
export type ClaimSummary = {
  id?: string;
  display_id?: number | string | null;
  /** Medusa's ClaimType: "refund" or "replace". */
  type?: string | null;
  claimed_items?: (EmailLineItem & { reason?: string | null })[];
  replacement_items?: EmailLineItem[];
  /** Items the customer is asked to send back, if any. */
  return_items?: EmailLineItem[];
  location?: ReturnDestination | null;
  /** Set only when staff entered an amount on the claim. */
  refund_amount?: number | null;
  /** The order summary's `pending_difference` once the claim is confirmed. */
  pending_difference?: number | null;
};

export type ClaimCreatedEmailProps = {
  order: OrderDTO & { customer?: CustomerDTO };
  claim: ClaimSummary;
  /** Live store branding, supplied by the sending step. */
  brand?: BrandSummary;
};

function ClaimCreatedEmailComponent({
  order,
  claim,
  brand,
}: ClaimCreatedEmailProps) {
  const recipient =
    order.customer?.first_name ?? order.shipping_address?.first_name ?? "there";
  const isRefund = claim.type === "refund";
  const hasReplacements = Boolean(claim.replacement_items?.length);
  const hasReturnItems = Boolean(claim.return_items?.length);

  // A refund claim names its amount when staff entered one; otherwise the
  // order balance says what is owed back.
  const balance = describeOrderBalance(
    claim.pending_difference,
    order.currency_code,
  );

  const getRefundAmount = () => {
    if (!isRefund) return "";
    if (claim.refund_amount && claim.refund_amount > 0)
      return formatMoney(claim.refund_amount, order.currency_code);
    if (balance.direction === "store_owes") return balance.amount;
    return "";
  };

  const refundAmount = getRefundAmount();

  const getHeading = () => {
    if (isRefund) return `We are refunding you, ${recipient}`;
    if (hasReplacements) return `A replacement is on its way, ${recipient}`;
    return `We are sorting out your order, ${recipient}`;
  };

  const heading = getHeading();

  const claimedItems = claim.claimed_items?.map((item) => ({
    ...item,
    note: item.reason
      ? `Reason: ${CLAIM_REASON_LABELS[item.reason] ?? item.reason}`
      : null,
  }));

  return (
    <EmailLayout
      brand={brand}
      preview={`An update on order #${order.display_id}`}
      heading={heading}
      intro={`We are sorry something went wrong with order #${order.display_id}.`}
    >
      <Container className="px-6">
        <ItemList heading="What went wrong" items={claimedItems} />

        <ItemList heading="On its way to you" items={claim.replacement_items} />
        {hasReplacements && (
          <Text className="mt-4 text-gray-600">
            We will email you when it ships.
          </Text>
        )}

        {isRefund ? (
          refundAmount && (
            <Section className="my-6 rounded-lg bg-gray-50 p-4">
              <Text className="m-0 text-gray-800">
                We will refund <strong>{refundAmount}</strong> to your original
                payment method.
              </Text>
            </Section>
          )
        ) : (
          <BalanceNotice
            pendingDifference={claim.pending_difference}
            currencyCode={order.currency_code}
          />
        )}

        {hasReturnItems ? (
          <>
            <ItemList heading="Please send back" items={claim.return_items} />
            <ReturnDestinationSection destination={claim.location} />
          </>
        ) : (
          <Text className="mt-6 text-gray-600">
            You do not need to send anything back.
          </Text>
        )}

        <OrderPageButton orderId={order.id} />

        <Text className="mt-6 text-sm text-gray-500">
          Order ID: #{order.display_id}
        </Text>
      </Container>
    </EmailLayout>
  );
}

export const claimCreatedEmail = (props: ClaimCreatedEmailProps) => (
  <ClaimCreatedEmailComponent {...props} />
);

const mockProps = {
  order: {
    id: "order_01JSNXDH9BPJWWKVW03B9E9KW8",
    display_id: 1,
    currency_code: "ngn",
    customer: { first_name: "Ada" },
    shipping_address: { first_name: "Ada" },
  },
  claim: {
    id: "claim_01JSNXDH9BPJWWKVW03B9E9KW8",
    display_id: 1,
    type: "replace",
    claimed_items: [
      {
        title: "Relaxed Linen Shirt",
        variant_title: "White / M",
        quantity: 1,
        reason: "production_failure",
      },
    ],
    replacement_items: [
      { title: "Relaxed Linen Shirt", variant_title: "White / M", quantity: 1 },
    ],
    return_items: [],
    pending_difference: 0,
  },
};

export default function ClaimCreatedEmailPreview() {
  // @ts-ignore -- preview-only mock, not the full OrderDTO
  return <ClaimCreatedEmailComponent {...mockProps} />;
}
