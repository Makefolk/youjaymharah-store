import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import {
  CUSTOMER_EMAIL_VERIFIED_EVENT,
  type CustomerEmailVerifiedData,
} from "../lib/customer-events";
import { linkGuestOrders } from "../lib/link-guest-orders";

/** Brings the customer's guest orders into their account. */
export default async function customerEmailVerifiedHandler({
  event: { data },
  container,
}: SubscriberArgs<CustomerEmailVerifiedData>) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const linked = await linkGuestOrders(container, data);
  if (linked) {
    logger.info(
      `${CUSTOMER_EMAIL_VERIFIED_EVENT}: linked ${linked} guest order(s) to customer ${data.customer_id}.`,
    );
  }
}

export const config: SubscriberConfig = {
  event: CUSTOMER_EMAIL_VERIFIED_EVENT,
};
