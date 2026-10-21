import { MedusaError } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { findIneligibleRequest } from "../../lib/return-eligibility";
import { loadReturnContext } from "../utils/order-returns";

export type ValidateCustomerReturnInput = {
  order_id: string;
  items: { id: string; quantity: number }[];
  /** The signed-in customer, if any. */
  customer_id?: string | null;
  /** What a guest typed as the order's email. */
  email?: string | null;
};

/**
 * Only the order's own customer, or someone who knows the order's email, may
 * request a return. The order ID alone is not enough: it travels in links
 * that can be forwarded.
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
    const knowsEmail =
      Boolean(input.email && order.email) &&
      input.email!.trim().toLowerCase() === order.email!.trim().toLowerCase();
    if (!ownsOrder && !knowsEmail) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "That email doesn't match this order.",
      );
    }

    const problem = findIneligibleRequest(eligibility, input.items);
    if (problem) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, problem);
    }

    return new StepResponse({ order_id: order.id });
  },
);
