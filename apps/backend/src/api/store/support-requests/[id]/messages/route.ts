import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import type { StoreSupportReplyType } from "../../../../middlewares";
import { addSupportMessageWorkflow } from "../../../../../workflows/support";
import { loadAccessibleRequest, publicThread } from "../../../support-access";

/** The customer answers on their request; staff are emailed. */
export const POST = async (
  req: AuthenticatedMedusaRequest<StoreSupportReplyType>,
  res: MedusaResponse,
) => {
  const request = await loadAccessibleRequest(req, req.validatedBody.access);
  await addSupportMessageWorkflow(req.scope).run({
    input: {
      request_id: request.id,
      author: "customer",
      author_name: request.name,
      body: req.validatedBody.body,
      photos: req.validatedBody.photos,
    },
  });
  res.json({ messages: await publicThread(req, request.id) });
};
