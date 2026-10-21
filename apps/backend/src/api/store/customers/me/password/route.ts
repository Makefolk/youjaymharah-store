import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { Modules } from "@medusajs/framework/utils";

import type { StoreSetCustomerPasswordType } from "../../../../middlewares";
import { setCustomerPasswordWorkflow } from "../../../../../workflows/set-customer-password";

/**
 * Sets a password on an account that has none -- the Google-only case.
 *
 * /store/customers/me/* already requires a logged-in customer, and the email
 * is read from their account rather than the request, so this cannot be used
 * to attach a password to someone else's address. Changing an existing
 * one is POST /store/customers/me/password/change.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<StoreSetCustomerPasswordType>,
  res: MedusaResponse,
) => {
  await setCustomerPasswordWorkflow(req.scope).run({
    input: {
      customer_id: req.auth_context.actor_id,
      password: req.validatedBody.password,
    },
  });

  res.json({ success: true });
};

/** Which ways the customer signs in, so the account page offers "set" or "change". */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  const identity = await req.scope
    .resolve(Modules.AUTH)
    .retrieveAuthIdentity(req.auth_context.auth_identity_id!, {
      relations: ["provider_identities"],
    });
  const providers = (identity.provider_identities ?? []).map(
    (provider) => provider.provider,
  );
  res.json({
    has_password: providers.includes("emailpass"),
    google: providers.includes("google"),
  });
};
