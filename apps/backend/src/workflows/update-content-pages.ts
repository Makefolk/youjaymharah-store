import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import {
  updateContentPagesStep,
  type UpdateContentPagesInput,
} from "./steps/update-content-pages";

export const updateContentPagesWorkflow = createWorkflow(
  "update-content-pages",
  function (input: UpdateContentPagesInput) {
    return new WorkflowResponse(updateContentPagesStep(input));
  },
);
