import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { useQueryGraphStep } from "@medusajs/medusa/core-flows";

import { sendOrderConfirmationStep } from "./steps/send-order-confirmation";

export type ResendOrderConfirmationInput = {
  id: string;
  /** Unique per staff request; persisted, so step retries reuse it. */
  resend_key: string;
};

/**
 * Staff-triggered resend from the order page, typically after correcting a
 * mistyped address. Reads the order afresh, so it goes to the order's current
 * email.
 */
export const resendOrderConfirmationWorkflow = createWorkflow(
  "resend-order-confirmation",
  function (input: ResendOrderConfirmationInput) {
    useQueryGraphStep({
      entity: "order",
      fields: ["id"],
      filters: { id: input.id },
      options: { throwIfKeyNotFound: true },
    });

    const result = sendOrderConfirmationStep(input);

    return new WorkflowResponse(result);
  },
);
