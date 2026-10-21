import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { completeCartWorkflow } from "@medusajs/medusa/core-flows";

import { validatePaidCartStep } from "./steps/validate-paid-cart";

/**
 * Support's fix for "I paid but got no order": completes the paid cart the
 * way the storefront would have, which verifies the payment with the gateway
 * once more, reserves stock and sends the confirmation email. Fails without
 * side effects if something sold out meanwhile; then refund the customer.
 */
export const createOrderFromPaymentWorkflow = createWorkflow(
  "create-order-from-payment",
  function (input: { session_id: string }) {
    const { cart_id } = validatePaidCartStep(input);

    const order = completeCartWorkflow.runAsStep({
      input: transform({ cart_id }, ({ cart_id }) => ({ id: cart_id })),
    });

    return new WorkflowResponse({ order_id: order.id });
  },
);
