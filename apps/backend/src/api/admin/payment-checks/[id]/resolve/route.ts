import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import type { AdminResolvePaymentCheckType } from "../../../../middlewares";
import { resolvePaymentCheckWorkflow } from "../../../../../workflows/reconcile-payments";

/** Staff dealt with a flagged payment outside the store, and say how. */
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminResolvePaymentCheckType>,
  res: MedusaResponse,
) => {
  const { result } = await resolvePaymentCheckWorkflow(req.scope).run({
    input: {
      id: req.params.id,
      resolved_by: req.auth_context.actor_id,
      note: req.validatedBody.note,
    },
  });
  res.json({ payment_check: result });
};
