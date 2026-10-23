import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import { revokeSupportLinksWorkflow } from "../../../../../workflows/support";

/**
 * Cancels every emailed link to the request issued so far, for a link that
 * was forwarded or leaked. The customer's next email carries a new one.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  const { result } = await revokeSupportLinksWorkflow(req.scope).run({
    input: { id: req.params.id },
  });
  res.json({ request: result });
};
