import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import type { StoreSupportAccessType } from "../../../middlewares";
import {
  loadAccessibleRequest,
  publicRequest,
  publicThread,
} from "../../support-access";

/** One request and its conversation, for its owner or link holder. */
export const GET = async (
  req: AuthenticatedMedusaRequest<unknown, StoreSupportAccessType>,
  res: MedusaResponse,
) => {
  const request = await loadAccessibleRequest(req, req.validatedQuery.access);
  res.json({
    request: {
      ...publicRequest(request),
      messages: await publicThread(req, request.id),
    },
  });
};
