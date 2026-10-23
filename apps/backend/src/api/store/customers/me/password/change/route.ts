import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { generateJwtTokenForAuthIdentity } from "@medusajs/medusa/api/auth/utils/generate-jwt-token";

import type { StoreChangePasswordType } from "../../../../../middlewares";
import { changeCustomerPasswordWorkflow } from "../../../../../../workflows/change-customer-password";

/**
 * Changes an existing password, after checking the current one. Accounts
 * without a password (Google-only) set one with POST
 * /store/customers/me/password instead.
 *
 * Every earlier sign-in ends, this one included, so the response carries a
 * fresh token for the device that made the change.
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

  const { http } = req.scope.resolve(
    ContainerRegistrationKeys.CONFIG_MODULE,
  ).projectConfig;
  const authIdentity = await req.scope
    .resolve(Modules.AUTH)
    .retrieveAuthIdentity(req.auth_context.auth_identity_id!, {
      relations: ["provider_identities"],
    });
  const token = await generateJwtTokenForAuthIdentity(
    {
      authIdentity,
      actorType: "customer",
      authProvider: req.auth_context.auth_provider,
      container: req.scope,
    },
    {
      secret: http.jwtSecret!,
      expiresIn: http.jwtExpiresIn,
      options: http.jwtOptions,
    },
  );

  res.json({ changed: true, token });
};
