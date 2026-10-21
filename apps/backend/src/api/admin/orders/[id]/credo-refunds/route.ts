import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import type { AdminRecordCredoRefundType } from "../../../../middlewares";
import { recordCredoRefundWorkflow } from "../../../../../workflows/record-credo-refund";

/** Records a refund already made in the Credo dashboard. */
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminRecordCredoRefundType>,
  res: MedusaResponse,
) => {
  await recordCredoRefundWorkflow(req.scope).run({
    input: {
      order_id: req.params.id,
      ...req.validatedBody,
      user_id: req.auth_context.actor_id,
    },
  });

  res.json({ recorded: true });
};
