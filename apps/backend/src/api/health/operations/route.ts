import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import type { ICachingModuleService } from "@medusajs/framework/types";
import { MedusaError, Modules } from "@medusajs/framework/utils";

import {
  WORKER_HEARTBEAT_KEY,
  WORKER_STALE_MS,
} from "../../../lib/worker-heartbeat";
import { PAYMENT_RECONCILIATION_MODULE } from "../../../modules/payment-reconciliation";
import type PaymentReconciliationModuleService from "../../../modules/payment-reconciliation/service";
import { checkReadiness } from "../readiness";

/** A payment check this overdue means reconciliation isn't keeping up. */
const PAYMENT_CHECKS_LATE_MS = 30 * 60 * 1000;

/**
 * Whether background work is running, for the uptime probe: the worker's
 * heartbeat is recent, and payment checks aren't piling up overdue. A
 * stopped worker otherwise goes unnoticed while /health stays green: no
 * email retries, payment checks, reminders or alerts.
 *
 * Separate from /health, which gates deploys: a worker restarting must not
 * fail a release. Like /health, it names states only, never counts or
 * details.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const { ok, checks } = await checkReadiness({
    worker: async () => {
      const cache: ICachingModuleService = req.scope.resolve(Modules.CACHING);
      const beat = (await cache.get({ key: WORKER_HEARTBEAT_KEY })) as {
        at: number;
      } | null;
      if (!beat || Date.now() - beat.at > WORKER_STALE_MS) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "No recent worker heartbeat.",
        );
      }
    },
    payment_checks: async () => {
      const checks: PaymentReconciliationModuleService = req.scope.resolve(
        PAYMENT_RECONCILIATION_MODULE,
      );
      const late = await checks.listPaymentChecks(
        {
          status: ["checking", "needs_staff"],
          next_check_at: {
            $lt: new Date(Date.now() - PAYMENT_CHECKS_LATE_MS),
          },
        },
        { take: 1, select: ["id"] },
      );
      if (late.length) {
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "Payment checks are overdue.",
        );
      }
    },
  });

  res.setHeader("Cache-Control", "no-store");
  res
    .status(ok ? 200 : 503)
    .json({ status: ok ? "ok" : "unavailable", checks });
};
