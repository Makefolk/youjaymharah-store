import type {
  AuthContext,
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import type { ICachingModuleService } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

const READS = new Set(["GET", "HEAD", "OPTIONS"]);
const CACHE_SECONDS = 60;

/** Whether the identity has an enabled authenticator, cached briefly. */
async function hasEnabledFactor(
  req: MedusaRequest,
  authIdentityId: string,
): Promise<boolean> {
  const key = `admin-mfa:${authIdentityId}`;
  let cache: ICachingModuleService | undefined;
  try {
    cache = req.scope.resolve(Modules.CACHING);
    const hit = (await cache.get({ key })) as { enabled: boolean } | null;
    if (hit) return hit.enabled;
  } catch {
    // Ask the database instead.
  }
  const factors = await req.scope
    .resolve(Modules.AUTH)
    .listAuthMfa(
      { auth_identity_id: authIdentityId, status: "enabled" } as never,
      { take: 1, select: ["id"] },
    );
  const enabled = factors.length > 0;
  await cache
    ?.set({ key, data: { enabled }, ttl: CACHE_SECONDS })
    .catch(() => undefined);
  return enabled;
}

/**
 * With ADMIN_MFA_REQUIRED=true, staff without an authenticator app can look
 * around the admin but not change anything until they set one up (Profile ›
 * Two-factor authentication, which uses /auth/mfa and so stays open).
 * Reads stay open so the dashboard still loads and they can find it.
 * Medusa itself asks for the code at every sign-in once it is set up.
 * Secret API keys (scripts, integrations) are not people and are exempt.
 */
export async function requireAdminMfa(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  if (process.env.ADMIN_MFA_REQUIRED !== "true" || READS.has(req.method)) {
    return next();
  }
  const auth = (req as MedusaRequest & { auth_context?: AuthContext })
    .auth_context;
  if (auth?.actor_type !== "user" || !auth.auth_identity_id) return next();

  if (await hasEnabledFactor(req, auth.auth_identity_id)) return next();

  res.status(403).json({
    type: "not_allowed",
    message:
      "Set up two-factor authentication before making changes: Profile › Two-factor authentication. Until then you can view but not edit.",
  });
}
