import type { ICachingModuleService } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { SESSION_REVOCATION_MODULE } from "../../modules/session-revocation";
import type SessionRevocationModuleService from "../../modules/session-revocation/service";
import type { SessionActor } from "../../modules/session-revocation/service";
import {
  SESSION_CUTOFF_CACHE_SECONDS,
  sessionCutoffCacheKey,
} from "../../api/session-revocation";

export type SignOutEverywhereInput = { actors: SessionActor[] };

/**
 * Ends every sign-in the actors made until now: tokens and admin sessions
 * issued before this moment are refused (api/session-revocation.ts).
 *
 * Not compensated: signing someone out can't be undone safely, and a later
 * step failing is no reason to let a possibly stolen session back in.
 */
export const signOutEverywhereStep = createStep(
  "sign-out-everywhere",
  async ({ actors }: SignOutEverywhereInput, { container }) => {
    if (!actors.length) return new StepResponse({ signed_out: 0 });

    // Whole seconds, like a token's `iat`. A sign-in in this same second
    // still counts, so the new token handed out afterwards works.
    const at = new Date(Math.floor(Date.now() / 1000) * 1000);
    const revocation: SessionRevocationModuleService = container.resolve(
      SESSION_REVOCATION_MODULE,
    );
    await revocation.signOutBefore(actors, at);

    // The check caches cutoffs for a minute; replace them now. Should the cache
    // be unreachable, its copy expires within the minute anyway.
    const cache: ICachingModuleService = container.resolve(Modules.CACHING);
    await Promise.all(
      actors.map((actor) =>
        cache
          .set({
            key: sessionCutoffCacheKey(actor),
            data: { at: at.getTime() / 1000 },
            ttl: SESSION_CUTOFF_CACHE_SECONDS,
          })
          .catch(() => undefined),
      ),
    );

    return new StepResponse({ signed_out: actors.length });
  },
);

/**
 * Who signs in through an auth identity: Medusa records each actor's id in
 * its app_metadata (`customer_id`, `user_id`). One email can be both, and a
 * password belongs to the identity, so changing it ends both.
 */
export function actorsOf(
  appMetadata: Record<string, unknown> | null | undefined,
): SessionActor[] {
  return Object.entries(appMetadata ?? {}).flatMap(([key, value]) =>
    key.endsWith("_id") && typeof value === "string" && value
      ? [{ actor_type: key.slice(0, -3), actor_id: value }]
      : [],
  );
}
