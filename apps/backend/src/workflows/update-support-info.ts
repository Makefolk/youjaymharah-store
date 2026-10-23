import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import { notifyStorefrontStep } from "./steps/notify-storefront";
import {
  updateSupportInfoStep,
  type UpdateSupportInfoInput,
} from "./steps/update-support-info";

export const updateSupportInfoWorkflow = createWorkflow(
  "update-support-info",
  function (input: UpdateSupportInfoInput) {
    const result = updateSupportInfoStep(input);

    // The storefront's public settings include the support details.
    notifyStorefrontStep({ tags: ["storefront-settings"] });

    return new WorkflowResponse(result);
  },
);
