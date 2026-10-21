import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import {
  prepareContactMessageStep,
  type ContactMessageInput,
} from "./steps/prepare-contact-message";
import { sendPreparedEmailsStep } from "./steps/send-prepared-email";

/**
 * A message from the website's contact form: emailed to the support inbox,
 * with the customer as reply-to, and acknowledged to the customer.
 */
export const sendContactMessageWorkflow = createWorkflow(
  "send-contact-message",
  function (input: ContactMessageInput) {
    const prepared = prepareContactMessageStep(input);

    sendPreparedEmailsStep(
      transform({ prepared }, ({ prepared }) => [
        prepared.to_support,
        prepared.to_customer,
      ]),
    );

    return new WorkflowResponse({ sent: true });
  },
);
