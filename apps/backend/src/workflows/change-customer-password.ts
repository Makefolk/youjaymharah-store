import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import {
  changeCustomerPasswordStep,
  type ChangeCustomerPasswordInput,
} from "./steps/change-customer-password";

export const changeCustomerPasswordWorkflow = createWorkflow(
  "change-customer-password",
  function (input: ChangeCustomerPasswordInput) {
    return new WorkflowResponse(changeCustomerPasswordStep(input));
  },
);
