/** Where the worker records that it is running (jobs/worker-heartbeat.ts). */
export const WORKER_HEARTBEAT_KEY = "operations:worker-heartbeat";

/** The heartbeat is written every minute; this long without one is a stop. */
export const WORKER_STALE_MS = 5 * 60 * 1000;
