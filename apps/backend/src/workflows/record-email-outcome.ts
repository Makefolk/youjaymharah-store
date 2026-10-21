import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import type { EmailOutcomeEvent } from "../modules/email-delivery/outcome";
import { recordEmailOutcomeStep } from "./steps/record-email-outcome";

/**
 * Stores what Resend reports after accepting an email (delivered, bounced...)
 * on its delivery row, where the order page reads it.
 */
export const recordEmailOutcomeWorkflow = createWorkflow(
  "record-email-outcome",
  function (input: EmailOutcomeEvent) {
    return new WorkflowResponse(recordEmailOutcomeStep(input));
  },
);
