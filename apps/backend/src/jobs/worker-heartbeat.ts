import type {
  ICachingModuleService,
  MedusaContainer,
} from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

import { WORKER_HEARTBEAT_KEY } from "../lib/worker-heartbeat";

/**
 * Says the worker is alive and running scheduled jobs: GET
 * /health/operations fails when this goes quiet, so the uptime probe
 * notices a stopped worker (no emails retried, no payments checked).
 */
export default async function workerHeartbeat(container: MedusaContainer) {
  const cache: ICachingModuleService = container.resolve(Modules.CACHING);
  await cache.set({
    key: WORKER_HEARTBEAT_KEY,
    data: { at: Date.now() },
    ttl: 60 * 60,
  });
}

export const config = {
  name: "worker-heartbeat",
  schedule: "* * * * *",
};
