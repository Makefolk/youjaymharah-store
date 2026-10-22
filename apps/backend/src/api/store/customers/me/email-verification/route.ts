import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils";
import { requestVerificationWorkflow } from "@medusajs/medusa/core-flows";

/** Providers that only sign in with an email they have already verified. */
const VERIFYING_PROVIDERS = new Set(["google"]);

async function verificationState(req: AuthenticatedMedusaRequest) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const authService = req.scope.resolve(Modules.AUTH);
  const authIdentityId = req.auth_context.auth_identity_id;

  const {
    data: [customer],
  } = await query.graph({
    entity: "customer",
    fields: ["email"],
    filters: { id: req.auth_context.actor_id },
  });
  const email = customer?.email?.trim().toLowerCase();
  if (!email || !authIdentityId) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "This account has no email address.",
    );
  }

  const [identity, verifications] = await Promise.all([
    authService.retrieveAuthIdentity(authIdentityId, {
      relations: ["provider_identities"],
    }),
    authService.listAuthVerifications({
      auth_identity_id: authIdentityId,
      entity_type: "email",
      entity_id: email,
    }),
  ]);

  const verified =
    (identity.provider_identities ?? []).some(
      (provider) =>
        VERIFYING_PROVIDERS.has(provider.provider) &&
        typeof provider.user_metadata?.email === "string" &&
        provider.user_metadata.email.trim().toLowerCase() === email,
    ) || verifications.some((verification) => verification.verified_at);

  return { email, verified, authIdentityId };
}

/** Whether the signed-in customer has verified their account's email. */
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  const { email, verified } = await verificationState(req);
  res.json({ email, verified });
};

/**
 * Emails the customer a verification link for their account's own address;
 * the address isn't taken from the request, so it can't be pointed at
 * someone else's inbox.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  const { email, verified, authIdentityId } = await verificationState(req);
  if (!verified) {
    await requestVerificationWorkflow(req.scope).run({
      input: {
        auth_identity_id: authIdentityId,
        entity_id: email,
        entity_type: "email",
        code_provider: "token",
      },
    });
  }
  res.json({ email, verified, sent: !verified });
};
