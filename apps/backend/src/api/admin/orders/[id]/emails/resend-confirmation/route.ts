import { randomUUID } from "node:crypto";
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import { resendOrderConfirmationWorkflow } from "../../../../../../workflows/resend-order-confirmation";

export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  const { result } = await resendOrderConfirmationWorkflow(req.scope).run({
    input: { id: req.params.id, resend_key: randomUUID() },
  });

  // No result means the send failed once and the workflow engine is retrying.
  res.json({ sent_to: result?.sent_to ?? null, pending: !result });
};
