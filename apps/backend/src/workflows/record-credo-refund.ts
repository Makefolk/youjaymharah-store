import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  acquireLockStep,
  releaseLockStep,
  refundPaymentWorkflow,
} from "@medusajs/medusa/core-flows";

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
  provider?: "credo" | "paystack";
};

/** Serializing authorization and recording prevents competing refunds from
 * replacing each other's one-use provider authorization. */
export const recordCredoRefundWorkflow = createWorkflow(
  "record-credo-refund",
  function (input: RecordCredoRefundInput) {
    const key = transform(
      { input },
      ({ input }) => `dashboard-refund:${input.payment_id}`,
    );
    acquireLockStep({ key, timeout: 5, ttl: 120 });
    authorizeDashboardRefundStep({
      order_id: input.order_id,
      payment_id: input.payment_id,
      amount: input.amount,
      reference: input.reference,
      user_id: input.user_id,
      provider: input.provider,
    });

    const refund = refundPaymentWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => ({
        payment_id: input.payment_id,
        amount: input.amount,
        created_by: input.user_id,
        refund_reason_id: input.refund_reason_id ?? undefined,
        note: [
          `Refunded in the ${input.provider === "paystack" ? "Paystack" : "Credo"} dashboard, reference ${input.reference}.`,
          input.note?.trim(),
        ]
          .filter(Boolean)
          .join(" "),
      })),
    });

    releaseLockStep({ key });

    return new WorkflowResponse(refund);
  },
);
