import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import { SUPPORT_MODULE } from "../../../../../../../modules/support";
import type SupportModuleService from "../../../../../../../modules/support/service";
import { sendSupportPhoto } from "../../../../../../support-photos";

/** A photo from a request's conversation, for staff who can read requests. */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  const service: SupportModuleService = req.scope.resolve(SUPPORT_MODULE);
  const [message] = await service.listSupportMessages(
    { id: req.params.message_id, request_id: req.params.id },
    { take: 1 },
  );
  await sendSupportPhoto(
    res,
    req.scope.resolve(ContainerRegistrationKeys.LOGGER),
    message,
    Number(req.params.index),
  );
};
