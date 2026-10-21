import { randomUUID } from "node:crypto";
import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import type { AdminResendShippingEmailType } from "../../../../../middlewares";
import { resendOrderShippedEmailWorkflow } from "../../../../../../workflows/resend-order-shipped-email";

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminResendShippingEmailType>,
  res: MedusaResponse,
) => {
  const { result } = await resendOrderShippedEmailWorkflow(req.scope).run({
    input: {
      order_id: req.params.id,
      fulfillment_id: req.validatedBody.fulfillment_id,
      resend_key: randomUUID(),
    },
  });

  // No result means the send failed once and the workflow engine is retrying.
  res.json({ sent_to: result?.sent_to ?? null, pending: !result });
};
