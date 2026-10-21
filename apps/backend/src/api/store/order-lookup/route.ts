import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";

import type { StoreOrderLookupType } from "../../middlewares";

/**
 * Finds a guest's order from the order number and email on their
 * confirmation. Both must match, and a miss says nothing about which one was
 * wrong, so the endpoint can't be used to find out whether an email has
 * ordered here.
 */
export const POST = async (
  req: MedusaRequest<StoreOrderLookupType>,
  res: MedusaResponse,
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { email, display_id } = req.validatedBody;

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "email"],
    // Typed as text in the generated filters; the column is an integer.
    filters: { display_id: String(display_id) },
  });

  const order = orders.find(
    (candidate) =>
      candidate.email?.trim().toLowerCase() === email.trim().toLowerCase(),
  );

  if (!order) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "We couldn't find an order with that number and email.",
    );
  }

  res.json({ order: { id: order.id } });
};
