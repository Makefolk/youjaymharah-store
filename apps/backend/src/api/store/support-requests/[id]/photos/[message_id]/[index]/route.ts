import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import type { StoreSupportAccessType } from "../../../../../../middlewares";
import { SUPPORT_MODULE } from "../../../../../../../modules/support";
import type SupportModuleService from "../../../../../../../modules/support/service";
import { sendSupportPhoto } from "../../../../../../support-photos";
import { loadAccessibleRequest } from "../../../../../../store/support-access";

/** A photo from the conversation, for the request's owner or link holder. */
export const GET = async (
  req: AuthenticatedMedusaRequest<unknown, StoreSupportAccessType>,
  res: MedusaResponse,
) => {
  const request = await loadAccessibleRequest(req, req.validatedQuery.access);
  const service: SupportModuleService = req.scope.resolve(SUPPORT_MODULE);
  const [message] = await service.listSupportMessages(
    { id: req.params.message_id, request_id: request.id, internal: false },
    { take: 1 },
  );
  await sendSupportPhoto(
    res,
    req.scope.resolve(ContainerRegistrationKeys.LOGGER),
    message,
    Number(req.params.index),
  );
};
