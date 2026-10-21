import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import {
  resolveEmailDeliveryStep,
  type ResolveEmailDeliveryInput,
} from "./steps/resolve-email-delivery";

export const resolveEmailDeliveryWorkflow = createWorkflow(
  "resolve-email-delivery",
  function (input: ResolveEmailDeliveryInput) {
    return new WorkflowResponse(resolveEmailDeliveryStep(input));
  },
);
