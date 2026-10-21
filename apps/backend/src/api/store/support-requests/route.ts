import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import { SUPPORT_MODULE } from "../../../modules/support";
import type SupportModuleService from "../../../modules/support/service";
import { publicRequest } from "../support-access";

/** The signed-in customer's requests, latest activity first. */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  const service: SupportModuleService = req.scope.resolve(SUPPORT_MODULE);
  const requests = await service.listSupportRequests(
    { customer_id: req.auth_context.actor_id },
    { order: { last_message_at: "DESC" }, take: 100 },
  );
  res.json({ requests: requests.map(publicRequest) });
};
