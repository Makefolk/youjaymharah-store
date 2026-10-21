import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import type { StoreChangePasswordType } from "../../../../../middlewares";
import { changeCustomerPasswordWorkflow } from "../../../../../../workflows/change-customer-password";

/**
 * Changes an existing password, after checking the current one. Accounts
 * without a password (Google-only) set one with POST
 * /store/customers/me/password instead.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<StoreChangePasswordType>,
  res: MedusaResponse,
) => {
  await changeCustomerPasswordWorkflow(req.scope).run({
    input: {
      auth_identity_id: req.auth_context.auth_identity_id!,
      current_password: req.validatedBody.current_password,
      new_password: req.validatedBody.new_password,
    },
  });
  res.json({ changed: true });
};
