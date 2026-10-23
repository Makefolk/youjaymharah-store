import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import {
  notifyStorefrontStep,
  type NotifyStorefrontInput,
} from "./steps/notify-storefront";

/** For subscribers: asks the storefront to refresh cached catalog data. */
export const refreshStorefrontCacheWorkflow = createWorkflow(
  "refresh-storefront-cache",
  function (input: NotifyStorefrontInput) {
    return new WorkflowResponse(notifyStorefrontStep(input));
  },
);
