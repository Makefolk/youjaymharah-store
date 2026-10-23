import {
  createWorkflow,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import {
  checkDuePaymentsStep,
  enqueuePaymentChecksStep,
  resolvePaymentCheckStep,
  type ResolvePaymentCheckInput,
} from "./steps/reconcile-payments";

/**
 * Every few minutes: track new gateway payment attempts, then check the ones
 * that are due. What it finds is kept, so a restart loses nothing, and
 * Needs attention reads it.
 */
export const reconcilePaymentsWorkflow = createWorkflow(
  "reconcile-payments",
  function () {
    const added = enqueuePaymentChecksStep();
    const checked = checkDuePaymentsStep();
    return new WorkflowResponse({ added, checked });
  },
);

export const resolvePaymentCheckWorkflow = createWorkflow(
  "resolve-payment-check",
  function (input: ResolvePaymentCheckInput) {
    return new WorkflowResponse(resolvePaymentCheckStep(input));
  },
);
