import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { MedusaError, Modules } from "@medusajs/framework/utils";

import { signOutEverywhereWorkflow } from "../../../../../workflows/sign-out-everywhere";
import { actorsOf } from "../../../../../workflows/steps/sign-out-everywhere";

/**
 * Replaces Medusa's route for finishing a password reset (POST
 * /auth/:actor_type/:auth_provider/update, authenticated by the emailed
 * reset token) so that it also ends every earlier sign-in. Whoever reset the
 * password because someone else got in should see that person signed out.
 *
 * Otherwise as Medusa's: the token identifies the account, never the body.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<Record<string, unknown>>,
  res: MedusaResponse,
) => {
  const { auth_provider } = req.params;
  const { authIdentity, success, error } = await req.scope
    .resolve(Modules.AUTH)
    .updateProvider(auth_provider, {
      ...req.body,
      entity_id: req.auth_context.actor_id,
    });

  if (!success || !authIdentity) {
    throw new MedusaError(
      MedusaError.Types.UNAUTHORIZED,
      error || "Unauthorized",
    );
  }

  await signOutEverywhereWorkflow(req.scope).run({
    input: { actors: actorsOf(authIdentity.app_metadata) },
  });

  res.status(200).json({ success: true });
};
