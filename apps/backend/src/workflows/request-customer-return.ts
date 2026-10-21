import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";
import {
  beginReturnOrderWorkflow,
  confirmReturnRequestWorkflow,
  requestItemReturnWorkflow,
} from "@medusajs/medusa/core-flows";

import { validateCustomerReturnStep } from "./steps/validate-customer-return";

export type RequestCustomerReturnInput = {
  order_id: string;
  items: { id: string; quantity: number; reason_id?: string | null }[];
  /** Shown to staff on each returned item. */
  note?: string | null;
  customer_id?: string | null;
  email?: string | null;
};

/**
 * A customer's return request from the storefront. It becomes a requested
 * return in the admin, the same as one staff create, without return
 * shipping: staff arrange pickup or drop-off, receive the items and refund.
 * Confirming the request emits order.return_requested, which emails the
 * customer.
 */
export const requestCustomerReturnWorkflow = createWorkflow(
  "request-customer-return",
  function (input: RequestCustomerReturnInput) {
    validateCustomerReturnStep(input);

    const actor = transform({ input }, ({ input }) =>
      input.customer_id ? input.customer_id : undefined,
    );

    const orderChange = beginReturnOrderWorkflow.runAsStep({
      input: transform({ input, actor }, ({ input, actor }) => ({
        order_id: input.order_id,
        created_by: actor,
        description: "Requested by the customer on the website",
      })),
    });

    const returnId = transform(
      { orderChange },
      ({ orderChange }) => orderChange.return_id as string,
    );

    requestItemReturnWorkflow.runAsStep({
      input: transform({ input, returnId }, ({ input, returnId }) => ({
        return_id: returnId,
        items: input.items.map((item) => ({
          id: item.id,
          quantity: item.quantity,
          reason_id: item.reason_id ?? undefined,
          note: input.note?.trim() || undefined,
        })),
      })),
    });

    confirmReturnRequestWorkflow.runAsStep({
      input: transform({ returnId, actor }, ({ returnId, actor }) => ({
        return_id: returnId,
        confirmed_by: actor,
      })),
    });

    return new WorkflowResponse({ return_id: returnId });
  },
);
