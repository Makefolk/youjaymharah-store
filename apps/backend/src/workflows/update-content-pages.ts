import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import { notifyStorefrontStep } from "./steps/notify-storefront";
import {
  updateContentPagesStep,
  type UpdateContentPagesInput,
} from "./steps/update-content-pages";

export const updateContentPagesWorkflow = createWorkflow(
  "update-content-pages",
  function (input: UpdateContentPagesInput) {
    const result = updateContentPagesStep(input);

    // The storefront caches content pages under its settings tag.
    notifyStorefrontStep({ tags: ["storefront-settings"] });

    return new WorkflowResponse(result);
  },
);
