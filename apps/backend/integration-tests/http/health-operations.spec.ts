import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import workerHeartbeat from "../../src/jobs/worker-heartbeat";
import { WORKER_HEARTBEAT_KEY } from "../../src/lib/worker-heartbeat";
import { PAYMENT_RECONCILIATION_MODULE } from "../../src/modules/payment-reconciliation";
import type PaymentReconciliationModuleService from "../../src/modules/payment-reconciliation/service";
import { requireIsolatedDatabase } from "../helpers/isolated-database";

requireIsolatedDatabase();
jest.setTimeout(120_000);

medusaIntegrationTestRunner({
  inApp: true,
  dbName: "medusa-health-operations",
  testSuite: ({ api, getContainer }) => {
    describe("background work check", () => {
      const probe = () =>
        api.get("/health/operations", { validateStatus: () => true });

      it("fails while the worker is quiet, and passes once it beats", async () => {
        await getContainer()
          .resolve(Modules.CACHING)
          .clear({ key: WORKER_HEARTBEAT_KEY });
        const quiet = await probe();
        expect(quiet.status).toBe(503);
        expect(quiet.data.checks).toMatchObject({ worker: "fail" });

        await workerHeartbeat(getContainer());
        const alive = await probe();
        expect(alive.status).toBe(200);
        expect(alive.data).toEqual({
          status: "ok",
          checks: { worker: "ok", payment_checks: "ok" },
        });
      });

      it("fails when payment checks are long overdue", async () => {
        await workerHeartbeat(getContainer());
        await getContainer()
          .resolve<PaymentReconciliationModuleService>(
            PAYMENT_RECONCILIATION_MODULE,
          )
          .createPaymentChecks({
            session_id: "payses_overdue",
            provider_id: "pp_paystack_paystack",
            reference: "paysesoverdue",
            amount: 1000,
            currency_code: "ngn",
            session_created_at: new Date(Date.now() - 2 * 60 * 60 * 1000),
            next_check_at: new Date(Date.now() - 60 * 60 * 1000),
          });
        const behind = await probe();
        expect(behind.status).toBe(503);
        expect(behind.data.checks).toMatchObject({
          worker: "ok",
          payment_checks: "fail",
        });
      });
    });
  },
});
