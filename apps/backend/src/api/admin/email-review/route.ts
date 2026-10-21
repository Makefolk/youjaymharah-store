import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import { listEmailReviewQueue } from "../email-review";

/** Emails whose outcome is unknown, for a person to check against Resend. */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  res.json(await listEmailReviewQueue(req.scope));
};
