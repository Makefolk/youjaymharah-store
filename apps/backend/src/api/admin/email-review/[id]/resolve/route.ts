import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import type { AdminResolveEmailDeliveryType } from "../../../../middlewares";
import { resolveEmailDeliveryWorkflow } from "../../../../../workflows/resolve-email-delivery";

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminResolveEmailDeliveryType>,
  res: MedusaResponse,
) => {
  const body = req.validatedBody;
  const { result } = await resolveEmailDeliveryWorkflow(req.scope).run({
    input: {
      id: req.params.id,
      resolution: body.resolution,
      provider_id: body.resolution === "sent" ? body.provider_id : null,
      note: body.note,
      user_id: req.auth_context.actor_id,
    },
  });

  res.json({ delivery: result });
};
