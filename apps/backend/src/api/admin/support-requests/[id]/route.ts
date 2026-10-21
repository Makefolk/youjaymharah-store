import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import type { AdminUpdateSupportRequestType } from "../../../middlewares";
import { SUPPORT_MODULE } from "../../../../modules/support";
import type SupportModuleService from "../../../../modules/support/service";
import { updateSupportRequestWorkflow } from "../../../../workflows/support";

/** A request with its whole conversation, staff notes included. */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  const service: SupportModuleService = req.scope.resolve(SUPPORT_MODULE);
  const request = await service.retrieveSupportRequest(req.params.id);
  const messages = await service.listSupportMessages(
    { request_id: request.id },
    { order: { created_at: "ASC" } },
  );
  res.json({ request: { ...request, messages } });
};

/** Status, priority and who is working it. */
export const POST = async (
  req: AuthenticatedMedusaRequest<AdminUpdateSupportRequestType>,
  res: MedusaResponse,
) => {
  const { result } = await updateSupportRequestWorkflow(req.scope).run({
    input: { id: req.params.id, ...req.validatedBody },
  });
  res.json({ request: result });
};
