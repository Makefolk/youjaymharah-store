import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import { sendOrderShippedEmailStep } from "./steps/send-order-shipped-email";
import { validateShippedFulfillmentStep } from "./steps/validate-shipped-fulfillment";

export type ResendOrderShippedEmailInput = {
  order_id: string;
  fulfillment_id: string;
  /** Unique per staff request; persisted, so step retries reuse it. */
  resend_key: string;
};

/**
 * Staff-triggered resend of a shipment's email, with its tracking details,
 * typically after "I never got my tracking number" or a corrected address.
 * Reads the order afresh, so it goes to the order's current email.
 */
export const resendOrderShippedEmailWorkflow = createWorkflow(
  "resend-order-shipped-email",
  function (input: ResendOrderShippedEmailInput) {
    validateShippedFulfillmentStep({
      order_id: input.order_id,
      fulfillment_id: input.fulfillment_id,
    });

    const result = sendOrderShippedEmailStep({
      fulfillment_id: input.fulfillment_id,
      resend_key: input.resend_key,
    });

    return new WorkflowResponse(result);
  },
);
