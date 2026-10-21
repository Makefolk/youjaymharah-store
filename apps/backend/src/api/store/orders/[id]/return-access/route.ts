import { randomUUID } from "node:crypto";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

import { sendReturnAccessEmailWorkflow } from "../../../../../workflows/send-return-access-email";

/** "j•••@example.com": enough to recognise, without spelling it out. */
function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 1)}•••@${domain}`;
}

/**
 * Emails the order's own address a link for requesting a return without
 * signing in. Anyone holding the order's link may ask; only the inbox owner
 * receives it.
 */
export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const { result } = await sendReturnAccessEmailWorkflow(req.scope).run({
    input: { order_id: req.params.id, request_key: randomUUID() },
  });

  res.json({ sent_to: maskEmail(result.sent_to) });
};
