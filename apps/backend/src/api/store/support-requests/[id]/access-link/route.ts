import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

import { sendSupportLinkWorkflow } from "../../../../../workflows/support";

/**
 * "Email me a fresh link", for a customer whose link expired or was
 * cancelled. The link goes only to the request's own email, and the answer
 * is the same whether or not the request exists.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  await sendSupportLinkWorkflow(req.scope).run({
    input: { request_id: req.params.id },
  });
  res.json({ sent: true });
};
