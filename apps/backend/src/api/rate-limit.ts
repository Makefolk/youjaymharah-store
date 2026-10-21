import { createHash } from "node:crypto";
import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import type {
  ICachingModuleService,
  ILockingModule,
} from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

export function rateLimit(bucket: string, limit: number) {
  return async (
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction,
  ) => {
    const window = Math.floor(Date.now() / 60_000);
    const address = req.ip ?? req.socket.remoteAddress ?? "unknown";
    const key = `rate-limit:${bucket}:${window}:${createHash("sha256").update(address).digest("hex")}`;
    try {
      const cache: ICachingModuleService = req.scope.resolve(Modules.CACHING);
      const locking: ILockingModule = req.scope.resolve(Modules.LOCKING);
      const allowed = await locking.execute(key, async () => {
        const entry = (await cache.get({ key })) as { count: number } | null;
        const count = entry?.count ?? 0;
        if (count >= limit) return false;
        await cache.set({
          key,
          data: { count: count + 1 },
          ttl: 120,
          tags: [],
        });
        return true;
      });
      if (!allowed) {
        res.setHeader(
          "Retry-After",
          String(60 - (Math.floor(Date.now() / 1000) % 60)),
        );
        res.status(429).json({
          type: "too_many_requests",
          message: "Too many requests. Please try again shortly.",
        });
        return;
      }
    } catch {
      res.setHeader("Retry-After", "30");
      res.status(503).json({
        type: "unavailable",
        message: "Temporarily unavailable. Please try again shortly.",
      });
      return;
    }
    next();
  };
}
