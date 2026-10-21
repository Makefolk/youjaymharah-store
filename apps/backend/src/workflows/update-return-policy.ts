import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import {
  updateReturnPolicyStep,
  type UpdateReturnPolicyInput,
} from "./steps/update-return-policy";

export const updateReturnPolicyWorkflow = createWorkflow(
  "update-return-policy",
  function (input: UpdateReturnPolicyInput) {
    return new WorkflowResponse(updateReturnPolicyStep(input));
  },
);
