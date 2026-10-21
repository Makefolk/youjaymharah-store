import { MedusaError } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { isValidReturnAccessToken } from "../../lib/return-access";
import { findIneligibleRequest } from "../../lib/return-eligibility";
import { loadReturnContext } from "../utils/order-returns";

export type ValidateCustomerReturnInput = {
  order_id: string;
  items: { id: string; quantity: number }[];
  /** The signed-in customer, if any. */
  customer_id?: string | null;
  /** A guest's token from the emailed return link. */
  access?: string | null;
};

/**
 * Only the order's own customer, or a guest holding the link emailed to the
 * order's address, may request a return. Neither the order ID nor its email
 * is proof: both are visible to anyone with the order's link.
 */
export const validateCustomerReturnStep = createStep(
  "validate-customer-return",
  async (input: ValidateCustomerReturnInput, { container }) => {
    const context = await loadReturnContext(container, input.order_id);
    if (!context) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found.");
    }

    const { order, eligibility } = context;
    const ownsOrder =
      Boolean(input.customer_id) && input.customer_id === order.customer_id;
    const hasAccess = isValidReturnAccessToken(
      input.access,
      order.id,
      order.email,
    );
    if (!ownsOrder && !hasAccess) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This return link has expired or isn't for this order. Ask for a new one from the order page.",
      );
    }

    const problem = findIneligibleRequest(eligibility, input.items);
    if (problem) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, problem);
    }

    return new StepResponse({ order_id: order.id });
  },
);
