import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import type { AdminCreateOrderFromPaymentType } from "../../../middlewares";
import { createOrderFromPaymentWorkflow } from "../../../../workflows/create-order-from-payment";

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminCreateOrderFromPaymentType>,
  res: MedusaResponse,
) => {
  const { result } = await createOrderFromPaymentWorkflow(req.scope).run({
    input: { session_id: req.validatedBody.session_id },
  });

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: ["id", "display_id"],
    filters: { id: result.order_id },
  });

  res.json({ order: { id: order.id, display_id: order.display_id } });
};
