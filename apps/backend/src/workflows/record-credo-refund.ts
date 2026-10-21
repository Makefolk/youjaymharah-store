import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import { refundPaymentWorkflow } from "@medusajs/medusa/core-flows";

import { authorizeDashboardRefundStep } from "./steps/authorize-dashboard-refund";

export type RecordCredoRefundInput = {
  order_id: string;
  payment_id: string;
  /** In the currency's main unit, as the admin shows amounts. */
  amount: number;
  /** The refund's reference in the Credo dashboard. */
  reference: string;
  refund_reason_id?: string | null;
  note?: string | null;
  user_id: string;
};

/**
 * Records a refund staff made in the Credo dashboard as a real refund on the
 * order: the order's balance and Payments section update, it is attributed
 * to whoever recorded it with the Credo reference in its note, and the
 * customer gets the usual refund email. Medusa's own checks still apply, so
 * it can't exceed what was paid.
 */
export const recordCredoRefundWorkflow = createWorkflow(
  "record-credo-refund",
  function (input: RecordCredoRefundInput) {
    authorizeDashboardRefundStep({
      order_id: input.order_id,
      payment_id: input.payment_id,
      amount: input.amount,
      reference: input.reference,
      user_id: input.user_id,
    });

    const refund = refundPaymentWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => ({
        payment_id: input.payment_id,
        amount: input.amount,
        created_by: input.user_id,
        refund_reason_id: input.refund_reason_id ?? undefined,
        note: [
          `Refunded in the Credo dashboard, reference ${input.reference}.`,
          input.note?.trim(),
        ]
          .filter(Boolean)
          .join(" "),
      })),
    });

    return new WorkflowResponse(refund);
  },
);
