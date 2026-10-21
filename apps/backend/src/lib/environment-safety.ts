import { MedusaError } from "@medusajs/framework/utils";
import { snapshotKey } from "../modules/resend/snapshot";
import { approvedTrendingTerms } from "../modules/search-insights/approved-terms";

/**
 * Refuses to start production with configuration that would fail later and
 * quietly: no Redis for durable workflows, guessable session secrets, or no
 * key to encrypt pending emails. Called from medusa-config.ts, which every
 * backend process loads -- server, worker and the one-off migration container
 * -- so a bad deploy stops at migration, before the running version is
 * replaced. (Medusa runs no project `loaders` folder; a check placed there
 * would never run.)
 */
export function validateProductionEnvironment(env: NodeJS.ProcessEnv) {
  if (env.NODE_ENV !== "production") return;
  if (!env.REDIS_URL?.trim()) {
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Production requires REDIS_URL for durable workflows, shared sessions, caching, and locks.",
    );
  }
  for (const name of ["JWT_SECRET", "COOKIE_SECRET"] as const) {
    if ((env[name]?.length ?? 0) < 32) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Production requires a strong ${name} of at least 32 characters.`,
      );
    }
  }
  snapshotKey(env.EMAIL_DELIVERY_ENCRYPTION_KEY);
}

/**
 * The same gaps outside production, as warnings rather than a refusal to
 * start: a missing email key shouldn't block work on everything else, but
 * without one every email fails at send time with nothing said at boot.
 */
export function developmentEnvironmentWarnings(
  env: NodeJS.ProcessEnv,
): string[] {
  if (env.NODE_ENV === "production") return [];

  const warnings: string[] = [];

  try {
    snapshotKey(env.EMAIL_DELIVERY_ENCRYPTION_KEY);
  } catch {
    warnings.push(
      "EMAIL_DELIVERY_ENCRYPTION_KEY is missing or not 64 hex characters, so every email will fail to send. Generate one with `openssl rand -hex 32` and restart.",
    );
  }

  return warnings;
}

/**
 * A malformed SEARCH_TRENDING_TERMS would otherwise surface the first time a
 * search is recorded against it, far from the typo that caused it. Checked in
 * every environment: it is a mistake in the file, not a secret production
 * alone must have. The error names the variable without echoing its value.
 */
export function validateSearchEnvironment(env: NodeJS.ProcessEnv) {
  approvedTrendingTerms(env.SEARCH_TRENDING_TERMS);
}

/**
 * Google sign-in is on when all three of its settings are present; the
 * provider throws at boot if any is missing, so it is registered only then.
 * The storefront shows its button from the same answer.
 */
export function googleSignInEnabled(env: NodeJS.ProcessEnv): boolean {
  return Boolean(
    env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET && env.GOOGLE_CALLBACK_URL,
  );
}
