import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import type { AdminSupportReplyType } from "../../../../middlewares";
import { addSupportMessageWorkflow } from "../../../../../workflows/support";

/** A reply (emailed to the customer) or a staff-only note. */
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminSupportReplyType>,
  res: MedusaResponse,
) => {
  const {
    data: [user],
  } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "user",
    fields: ["first_name", "last_name", "email"],
    filters: { id: req.auth_context.actor_id },
  });
  const { result } = await addSupportMessageWorkflow(req.scope).run({
    input: {
      request_id: req.params.id,
      author: "staff",
      author_id: req.auth_context.actor_id,
      author_name:
        [user?.first_name, user?.last_name].filter(Boolean).join(" ") ||
        user?.email ||
        null,
      body: req.validatedBody.body,
      internal: req.validatedBody.internal,
    },
  });
  res.json({ message_id: result.message_id });
};
