import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import { notifyStorefrontStep } from "./steps/notify-storefront";
import {
  updateReturnPolicyStep,
  type UpdateReturnPolicyInput,
} from "./steps/update-return-policy";

export const updateReturnPolicyWorkflow = createWorkflow(
  "update-return-policy",
  function (input: UpdateReturnPolicyInput) {
    const result = updateReturnPolicyStep(input);

    // The storefront's public settings include the return policy.
    notifyStorefrontStep({ tags: ["storefront-settings"] });

    return new WorkflowResponse(result);
  },
);
