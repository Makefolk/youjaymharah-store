import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";

import { loadReturnContext } from "../../../../../workflows/utils/order-returns";

/**
 * What can still be returned from an order, under the store's return
 * policy, and the returns already requested. Public like
 * GET /store/orders/:id: the order ID is the key, and nothing here says more
 * than the order itself. Requesting a return is what needs proof.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const context = await loadReturnContext(req.scope, req.params.id);

  if (!context) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found.");
  }

  const { order, policy, eligibility } = context;

  res.json({
    return_policy: policy,
    eligibility,
    returns: (order.returns ?? [])
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
      .filter((item) => item.status !== "canceled")
      .map((item) => ({
        id: item.id,
        status: item.status,
        created_at: new Date(item.created_at).toISOString(),
        items: (item.items ?? [])
          .filter((line): line is NonNullable<typeof line> => Boolean(line))
          .map((line) => ({
            item_id: line.item_id,
            quantity: line.quantity,
          })),
      })),
  });
};
