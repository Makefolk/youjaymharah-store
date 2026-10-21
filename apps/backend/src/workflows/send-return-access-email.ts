import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import {
  prepareReturnAccessEmailStep,
  type SendReturnAccessEmailInput,
} from "./steps/prepare-return-access-email";
import { sendPreparedEmailStep } from "./steps/send-prepared-email";

/** Emails a guest the signed link that lets them request a return. */
export const sendReturnAccessEmailWorkflow = createWorkflow(
  "send-return-access-email",
  function (input: SendReturnAccessEmailInput) {
    const prepared = prepareReturnAccessEmailStep(input);
    sendPreparedEmailStep(prepared.notification);
    return new WorkflowResponse(prepared.result);
  },
);
