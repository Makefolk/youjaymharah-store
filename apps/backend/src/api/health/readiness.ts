export type CheckResult = "ok" | "fail" | "not_configured";

/** Resolves when the dependency answered; rejects or hangs when it did not. */
export type Probe = () => Promise<unknown>;

/** Long enough for a healthy round trip, short enough for a deploy gate. */
export const PROBE_TIMEOUT_MS = 2000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: NodeJS.Timeout | undefined;

  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error("timed out")), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * Runs every probe at once, each against its own timeout, so one slow
 * dependency cannot hold the answer past the deadline. A null probe is a
 * dependency this deployment doesn't use -- Redis on a laptop, say -- and is
 * reported as such rather than as a failure.
 */
export async function checkReadiness(
  probes: Record<string, Probe | null>,
  timeoutMs = PROBE_TIMEOUT_MS,
): Promise<{ ok: boolean; checks: Record<string, CheckResult> }> {
  const results = await Promise.all(
    Object.entries(probes).map(async ([name, probe]) => {
      if (!probe) return [name, "not_configured"] as const;

      try {
        await withTimeout(probe(), timeoutMs);
        return [name, "ok"] as const;
      } catch {
        return [name, "fail"] as const;
      }
    }),
  );

  const checks = Object.fromEntries(results) as Record<string, CheckResult>;

  return { ok: !Object.values(checks).includes("fail"), checks };
}
