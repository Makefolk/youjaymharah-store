import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import {
  updateSupportInfoStep,
  type UpdateSupportInfoInput,
} from "./steps/update-support-info";

export const updateSupportInfoWorkflow = createWorkflow(
  "update-support-info",
  function (input: UpdateSupportInfoInput) {
    return new WorkflowResponse(updateSupportInfoStep(input));
  },
);
