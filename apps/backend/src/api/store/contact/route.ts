import { randomUUID } from "node:crypto";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

import type { StoreContactMessageType } from "../../middlewares";
import { sendContactMessageWorkflow } from "../../../workflows/send-contact-message";

/** The website's contact form. */
export const POST = async (
  req: MedusaRequest<StoreContactMessageType>,
  res: MedusaResponse,
) => {
  const { website, ...message } = req.validatedBody;

  // A field people can't see: only a bot fills it in. Answer as if sent, so
  // it has no reason to try something else.
  if (!website) {
    await sendContactMessageWorkflow(req.scope).run({
      input: { ...message, request_key: randomUUID() },
    });
  }

  res.json({ sent: true });
};
