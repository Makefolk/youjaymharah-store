import type {
  AuthContext,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import { isValidOrderAccessKey } from "../lib/order-access";

/** Where the storefront sends an order link's key. */
export const ORDER_ACCESS_HEADER = "x-order-access";

/**
 * An order's routes open for its signed-in customer, or with a valid key
 * from an order link. Anyone else gets the same 404 as for a missing order,
 * so an ID says nothing about whether the order exists.
 */
export async function requireOrderAccess(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const orderId = req.params.id;
  if (isValidOrderAccessKey(req.get(ORDER_ACCESS_HEADER), orderId)) {
    return next();
  }

  const auth = (req as MedusaRequest & { auth_context?: AuthContext })
    .auth_context;
  if (auth?.actor_type === "customer" && auth.actor_id) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const {
      data: [order],
    } = await query.graph({
      entity: "order",
      fields: ["id", "customer_id"],
      filters: { id: orderId },
    });
    if (order?.customer_id === auth.actor_id) return next();
  }

  res.status(404).json({ type: "not_found", message: "Order not found." });
}
