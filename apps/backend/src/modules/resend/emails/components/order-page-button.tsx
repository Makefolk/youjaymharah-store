import { Button, Section } from "react-email";

import { orderPageUrl } from "../constants";

/** The order's page on the storefront: status, tracking and returns. */
export function OrderPageButton({
  orderId,
  label = "View your order",
}: {
  orderId?: string | null;
  label?: string;
}) {
  if (!orderId) {
    return null;
  }

  return (
    <Section className="my-6 text-center">
      <Button
        href={orderPageUrl(orderId)}
        className="rounded-lg bg-[#27272a] px-6 py-3 font-semibold text-white"
      >
        {label}
      </Button>
    </Section>
  );
}
