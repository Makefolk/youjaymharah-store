import {
  getAuthContextFromJwtToken,
  type MedusaNextFunction,
  type MedusaRequest,
  type MedusaResponse,
} from "@medusajs/framework/http";
import type {
  ICachingModuleService,
  MedusaContainer,
} from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

import { SESSION_REVOCATION_MODULE } from "../modules/session-revocation";
import type SessionRevocationModuleService from "../modules/session-revocation/service";
import type { SessionActor } from "../modules/session-revocation/service";

export const SESSION_CUTOFF_CACHE_SECONDS = 60;

export const sessionCutoffCacheKey = ({ actor_type, actor_id }: SessionActor) =>
  `session-cutoff:${actor_type}:${actor_id}`;

type Credential = {
  actor_type?: string;
  actor_id?: string;
  iat?: number;
};

async function cutoffFor(
  scope: MedusaContainer,
  actor: SessionActor,
): Promise<number | null> {
  const key = sessionCutoffCacheKey(actor);
  let cache: ICachingModuleService | undefined;
  try {
    cache = scope.resolve(Modules.CACHING);
    const hit = (await cache.get({ key })) as { at: number | null } | null;
    if (hit) return hit.at;
  } catch {
    // The database below is the record; the cache only saves a query.
  }
  const revocation: SessionRevocationModuleService = scope.resolve(
    SESSION_REVOCATION_MODULE,
  );
  const at = await revocation.cutoffFor(actor);
  await cache
    ?.set({ key, data: { at }, ttl: SESSION_CUTOFF_CACHE_SECONDS })
    .catch(() => undefined);
  return at;
}

/** True when the credential was issued before its actor's cutoff. */
async function hasEnded(scope: MedusaContainer, credential?: Credential) {
  if (
    !credential?.actor_id ||
    !credential.actor_type ||
    credential.actor_type === "api-key" ||
    typeof credential.iat !== "number"
  ) {
    return false;
  }
  const cutoff = await cutoffFor(scope, {
    actor_type: credential.actor_type,
    actor_id: credential.actor_id,
  });
  return cutoff !== null && credential.iat < cutoff;
}

/**
 * Refuses tokens and admin sessions issued before a password reset, a
 * password change or "Sign out of all devices".
 *
 * Medusa's JWTs are stateless and its admin sessions keep the token's claims,
 * so both carry `iat`, the moment of sign-in. Runs after Medusa's own
 * authentication for /admin and /store, and before the per-route checks:
 * - Store: the request carries on as a guest, so routes that need a customer
 *   answer 401 and the storefront drops its cookie.
 * - Admin: 401, and the session is forgotten.
 * - Token refresh and session creation: refused, so an ended token can't be
 *   swapped for a fresh one.
 */
export async function refuseEndedSessions(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const request = req as MedusaRequest & { auth_context?: Credential };
  const session = req.session as { auth_context?: Credential } | undefined;
  const { http } = req.scope.resolve(
    ContainerRegistrationKeys.CONFIG_MODULE,
  ).projectConfig;
  const bearer = getAuthContextFromJwtToken(
    req.headers.authorization,
    http.jwtSecret!,
    ["bearer"],
    ["*"],
    http.jwtPublicKey,
    http.jwtVerifyOptions ?? http.jwtOptions,
  ) as Credential | null;

  let ended: Credential | undefined;
  try {
    if (await hasEnded(req.scope, session?.auth_context)) {
      ended = session!.auth_context;
      delete session!.auth_context;
    }
    if (bearer && (await hasEnded(req.scope, bearer))) {
      ended = bearer;
      delete req.headers.authorization;
    }
  } catch {
    res.setHeader("Retry-After", "30");
    res.status(503).json({
      type: "unavailable",
      message: "Temporarily unavailable. Please try again shortly.",
    });
    return;
  }

  if (!ended) return next();

  if (
    request.auth_context?.actor_id === ended.actor_id &&
    request.auth_context?.actor_type === ended.actor_type
  ) {
    delete request.auth_context;
  }
  if (req.originalUrl.startsWith("/admin")) {
    res.status(401).json({
      type: "unauthorized",
      message: "Your session has ended. Please sign in again.",
    });
    return;
  }
  next();
}
