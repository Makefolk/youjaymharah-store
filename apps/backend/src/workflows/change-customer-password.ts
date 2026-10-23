import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import {
  changeCustomerPasswordStep,
  type ChangeCustomerPasswordInput,
} from "./steps/change-customer-password";
import { signOutEverywhereStep } from "./steps/sign-out-everywhere";

/** Changes the password, then ends every sign-in made with the old one. */
export const changeCustomerPasswordWorkflow = createWorkflow(
  "change-customer-password",
  function (input: ChangeCustomerPasswordInput) {
    const changed = changeCustomerPasswordStep(input);
    signOutEverywhereStep(changed);
    return new WorkflowResponse({ changed: true });
  },
);
