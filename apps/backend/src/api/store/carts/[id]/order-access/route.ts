import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";

import { createOrderAccessKey } from "../../../../../lib/order-access";

/**
 * The order link's key for the order a cart became, for the browser that
 * checked out: the cart ID is that browser's secret, and it can already read
 * the same details on the cart. The storefront proxy calls this when
 * completing a cart, so the confirmation page opens without an email.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const {
    data: [cart],
  } = await query.graph({
    entity: "cart",
    fields: ["id", "completed_at", "order.id"],
    filters: { id: req.params.id },
  });
  const orderId = (cart as { order?: { id: string } | null } | undefined)?.order
    ?.id;

  if (!cart?.completed_at || !orderId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "This bag hasn't become an order.",
    );
  }

  res.json({ order_id: orderId, key: createOrderAccessKey(orderId) });
};
