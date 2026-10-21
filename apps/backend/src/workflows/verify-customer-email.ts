import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { emitEventStep } from "@medusajs/medusa/core-flows";

import { CUSTOMER_EMAIL_VERIFIED_EVENT } from "../lib/customer-events";
import {
  confirmCustomerEmailStep,
  type ConfirmCustomerEmailInput,
} from "./steps/confirm-customer-email";

/**
 * Runs when a customer opens the link in their verification email. Emits
 * customer.email_verified, which brings their guest orders into the account
 * in the background.
 */
export const verifyCustomerEmailWorkflow = createWorkflow(
  "verify-customer-email",
  function (input: ConfirmCustomerEmailInput) {
    const verified = confirmCustomerEmailStep(input);

    emitEventStep({
      eventName: CUSTOMER_EMAIL_VERIFIED_EVENT,
      data: verified,
    });

    return new WorkflowResponse(verified);
  },
);
