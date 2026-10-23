import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import {
  signOutEverywhereStep,
  type SignOutEverywhereInput,
} from "./steps/sign-out-everywhere";

/** After a password reset or change, or on request from the account page. */
export const signOutEverywhereWorkflow = createWorkflow(
  "sign-out-everywhere",
  function (input: SignOutEverywhereInput) {
    return new WorkflowResponse(signOutEverywhereStep(input));
  },
);
