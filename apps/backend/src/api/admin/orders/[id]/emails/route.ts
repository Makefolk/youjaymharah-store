import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";

import { listEmailHistory } from "../../../email-history";

/**
 * The emails sent about an order and whether they arrived. Covers emails sent
 * since orders started being recorded against them; older ones are found by
 * address on the customer page.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: ["id"],
    filters: { id: req.params.id },
  });

  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found.");
  }

  const emails = await listEmailHistory(req.scope, {
    resource_type: "order",
    resource_id: order.id,
  });

  res.json({ emails });
};
