import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

import type { StoreVerifyCustomerEmailType } from "../../../middlewares";
import { verifyCustomerEmailWorkflow } from "../../../../workflows/verify-customer-email";

/**
 * Opens from the verification email, so it works signed out: the token alone
 * proves the click came from that inbox.
 */
export const POST = async (
  req: MedusaRequest<StoreVerifyCustomerEmailType>,
  res: MedusaResponse,
) => {
  const { result } = await verifyCustomerEmailWorkflow(req.scope).run({
    input: { token: req.validatedBody.token },
  });

  res.json({ email: result.email, verified: true });
};
