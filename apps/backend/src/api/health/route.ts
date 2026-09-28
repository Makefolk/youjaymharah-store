import { randomUUID } from "node:crypto";

import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

import { checkReadiness } from "./readiness";

/**
 * Readiness, in place of Medusa's built-in /health, which answers 200 whether
 * or not this process can reach its database or Redis. Medusa registers that
 * one after the app's routes, so this route answers first.
 *
 * The deploy gate, its automatic rollback and the uptime probe all read this
 * URL, so a release that cannot serve requests now fails them. The body names
 * each dependency's state but never an error message or connection detail.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const pg = req.scope.resolve(ContainerRegistrationKeys.PG_CONNECTION);
  const locking = req.scope.resolve(Modules.LOCKING);

  const { ok, checks } = await checkReadiness({
    // Awaited inside an async function: Knex's raw() is a thenable query
    // builder, not a Promise, and only runs when awaited.
    database: async () => {
      await pg.raw("select 1");
    },
    // A lock is a write and a delete on the same Redis the app's locks,
    // rate limits and queues use. A unique key keeps concurrent probes from
    // queueing behind each other and failing on their own contention.
    redis: process.env.REDIS_URL?.trim()
      ? () =>
          locking.execute(`health:${randomUUID()}`, async () => undefined, {
            timeout: 2,
          })
      : null,
  });

  res.setHeader("Cache-Control", "no-store");
  res
    .status(ok ? 200 : 503)
    .json({ status: ok ? "ok" : "unavailable", checks });
};
