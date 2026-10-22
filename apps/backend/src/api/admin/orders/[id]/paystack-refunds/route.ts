import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import type { AdminRecordPaystackRefundType } from "../../../../middlewares";
import { recordCredoRefundWorkflow } from "../../../../../workflows/record-credo-refund";

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminRecordPaystackRefundType>,
  res: MedusaResponse,
) => {
  await recordCredoRefundWorkflow(req.scope).run({
    input: {
      ...req.validatedBody,
      order_id: req.params.id,
      user_id: req.auth_context.actor_id,
      provider: "paystack",
    },
  });
  res.json({ recorded: true });
};
