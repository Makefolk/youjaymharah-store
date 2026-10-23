import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  beginReturnOrderWorkflow,
  completeCartWorkflow,
  confirmReturnRequestWorkflow,
  createOrderFulfillmentWorkflow,
  createUsersWorkflow,
  requestItemReturnWorkflow,
} from "@medusajs/medusa/core-flows";
import { provisionRbacRoles } from "../../src/lib/rbac-roles";
import { requireIsolatedDatabase } from "../helpers/isolated-database";
import { physicalCheckoutFixture } from "../helpers/physical-checkout";
import { PAYMENT_RECONCILIATION_MODULE } from "../../src/modules/payment-reconciliation";
import type PaymentReconciliationModuleService from "../../src/modules/payment-reconciliation/service";
import { reconcilePaymentsWorkflow } from "../../src/workflows/reconcile-payments";

requireIsolatedDatabase();
jest.setTimeout(120_000);

const DAY_MS = 24 * 60 * 60 * 1000;

medusaIntegrationTestRunner({
  inApp: true,
  dbName: "medusa-attention-integration",
  testSuite: ({ api, getContainer, utils }) => {
    describe("needs attention", () => {
      let gatewayStatus = "success";

      beforeEach(async () => {
        gatewayStatus = "success";
        await provisionRbacRoles(getContainer());
        jest.spyOn(global, "fetch").mockImplementation(async (url, options) => {
          const target = new URL(String(url));
          if (target.origin === "https://api.resend.com")
            return new Response(JSON.stringify({ id: "re_attention" }));
          if (target.origin !== "https://api.paystack.co")
            throw new Error("Unexpected external request in attention test");
          const body = options?.body ? JSON.parse(String(options.body)) : {};
          const reference =
            body.reference ??
            decodeURIComponent(target.pathname.split("/").at(-1)!);
          const data = target.pathname.startsWith("/transaction/verify/")
            ? {
                reference,
                status: gatewayStatus,
                currency: "NGN",
                amount: 129000,
              }
            : { reference, authorization_url: "https://example.com/pay" };
          return new Response(JSON.stringify({ status: true, data }));
        });
      });

      afterEach(async () => {
        await new Promise<void>((resolve) => setImmediate(resolve));
        await utils.waitWorkflowExecutions();
        jest.restoreAllMocks();
      });

      async function login(role: string) {
        const container = getContainer();
        const email = `${role}-${Date.now()}@example.com`;
        const password = "isolated-test-password-only";
        const { result: users } = await createUsersWorkflow(container).run({
          input: { users: [{ email, roles: [role] }] },
        });
        const auth = container.resolve(Modules.AUTH);
        const { authIdentity } = await auth.register("emailpass", {
          body: { email, password },
        });
        await auth.updateAuthIdentities({
          id: authIdentity!.id,
          app_metadata: { user_id: users[0].id },
        });
        const { data } = await api.post("/auth/user/emailpass", {
          email,
          password,
        });
        return { headers: { Authorization: `Bearer ${data.token}` } };
      }

      /** Moves a row back in time, as if it had waited that long. */
      async function age(table: string, id: string, ms: number) {
        const pg = getContainer().resolve(
          ContainerRegistrationKeys.PG_CONNECTION,
        );
        await pg(table)
          .where({ id })
          .update({ created_at: new Date(Date.now() - ms) });
      }

      it("lists a paid bag with no order, a waiting return and an unshipped order", async () => {
        const container = getContainer();
        const fixture = await physicalCheckoutFixture(container);

        // A bag the gateway says was paid, that never became an order.
        // Made first: the fixture stocks one unit, which the order below takes.
        const abandoned = await fixture.cart();
        await age("payment_session", abandoned.sessionId, 60 * 60 * 1000);

        // A paid order nobody has shipped, with a return request waiting.
        const placed = await fixture.cart();
        const { result: order } = await completeCartWorkflow(container).run({
          input: { id: placed.id },
        });
        const query = container.resolve(ContainerRegistrationKeys.QUERY);
        const {
          data: [withItems],
        } = await query.graph({
          entity: "order",
          fields: ["id", "display_id", "items.id"],
          filters: { id: order.id },
        });
        await age("order", order.id, 5 * DAY_MS);
        // Packed but never shipped: still unshipped, and returnable.
        await createOrderFulfillmentWorkflow(container).run({
          input: {
            order_id: order.id,
            location_id: fixture.locationId,
            items: [{ id: withItems.items![0]!.id, quantity: 1 }],
          },
        });

        const { result: change } = await beginReturnOrderWorkflow(
          container,
        ).run({ input: { order_id: order.id } });
        await requestItemReturnWorkflow(container).run({
          input: {
            return_id: change.return_id!,
            items: [{ id: withItems.items![0]!.id, quantity: 1 }],
          },
        });
        await confirmReturnRequestWorkflow(container).run({
          input: { return_id: change.return_id! },
        });
        await age("return", change.return_id!, 4 * DAY_MS);

        await reconcilePaymentsWorkflow(container).run();
        const support = await login("role_support");
        const { data } = await api.get("/admin/attention", support);

        expect(data.payments).toEqual([
          expect.objectContaining({
            session_id: abandoned.sessionId,
            verdict: "paid_no_order",
            email: "physical-checkout@example.com",
          }),
        ]);
        expect(data.returns).toEqual([
          expect.objectContaining({
            order_id: order.id,
            display_id: withItems.display_id,
          }),
        ]);
        expect(data.unshipped).toEqual([
          expect.objectContaining({ id: order.id }),
        ]);
        expect(data.emails_to_review).toBe(0);
      });

      it("keeps a flagged payment until it becomes an order or staff mark it handled", async () => {
        const container = getContainer();
        const fixture = await physicalCheckoutFixture(container);
        const first = await fixture.cart();
        await age("payment_session", first.sessionId, 60 * 60 * 1000);
        await reconcilePaymentsWorkflow(container).run();

        const support = await login("role_support");
        const marketing = await login("role_marketing");
        const before = await api.get("/admin/attention", support);
        const flagged = before.data.payments.find(
          (payment: { session_id: string }) =>
            payment.session_id === first.sessionId,
        );
        expect(flagged).toMatchObject({ verdict: "paid_no_order" });

        // Marketing can't touch payments.
        await expect(
          api.post(
            `/admin/payment-checks/${flagged.id}/resolve`,
            { note: "Refunded" },
            marketing,
          ),
        ).rejects.toMatchObject({ response: { status: 403 } });
        await api.post(
          `/admin/payment-checks/${flagged.id}/resolve`,
          { note: "Refunded in Paystack, customer told." },
          support,
        );
        const after = await api.get("/admin/attention", support);
        expect(
          after.data.payments.map((payment: { id: string }) => payment.id),
        ).not.toContain(flagged.id);
        const check = await container
          .resolve<PaymentReconciliationModuleService>(
            PAYMENT_RECONCILIATION_MODULE,
          )
          .retrievePaymentCheck(flagged.id);
        expect(check).toMatchObject({
          status: "resolved",
          resolution: "handled",
          note: "Refunded in Paystack, customer told.",
          resolved_by: expect.stringMatching(/^user_/),
        });
      });

      it("clears a flagged payment once its bag becomes an order", async () => {
        const container = getContainer();
        const fixture = await physicalCheckoutFixture(container);
        const bag = await fixture.cart();
        await age("payment_session", bag.sessionId, 60 * 60 * 1000);
        await reconcilePaymentsWorkflow(container).run();
        const checks = container.resolve<PaymentReconciliationModuleService>(
          PAYMENT_RECONCILIATION_MODULE,
        );
        const [flagged] = await checks.listPaymentChecks({
          session_id: bag.sessionId,
        });
        expect(flagged).toMatchObject({ status: "needs_staff" });

        await completeCartWorkflow(container).run({ input: { id: bag.id } });
        // Due again now, as if five minutes had passed.
        await checks.updatePaymentChecks({
          id: flagged.id,
          next_check_at: new Date(),
        });
        await reconcilePaymentsWorkflow(container).run();
        expect(await checks.retrievePaymentCheck(flagged.id)).toMatchObject({
          status: "resolved",
          resolution: "order_placed",
        });
      });

      it("leaves out unpaid bags and keeps Marketing out", async () => {
        gatewayStatus = "abandoned";
        const container = getContainer();
        const fixture = await physicalCheckoutFixture(container);
        const unpaid = await fixture.cart();
        await age("payment_session", unpaid.sessionId, 60 * 60 * 1000);

        await reconcilePaymentsWorkflow(container).run();
        const support = await login("role_support");
        const { data } = await api.get("/admin/attention", support);
        expect(data.payments).toEqual([]);

        const marketing = await login("role_marketing");
        await expect(
          api.get("/admin/attention", marketing),
        ).rejects.toMatchObject({ response: { status: 403 } });
      });
    });
  },
});
