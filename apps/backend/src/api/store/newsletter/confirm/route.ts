import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

import type { StoreNewsletterConfirmType } from "../../../middlewares";
import { confirmNewsletterSubscriptionWorkflow } from "../../../../workflows/newsletter";

export const POST = async (
  req: MedusaRequest<StoreNewsletterConfirmType>,
  res: MedusaResponse,
) => {
  await confirmNewsletterSubscriptionWorkflow(req.scope).run({
    input: req.validatedBody,
  });

  res.json({ success: true, status: "subscribed" });
};
