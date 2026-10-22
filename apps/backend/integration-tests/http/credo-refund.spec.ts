import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import type { IPaymentModuleService } from "@medusajs/framework/types";
import {
  completeCartWorkflow,
  createUsersWorkflow,
} from "@medusajs/medusa/core-flows";
import { provisionRbacRoles } from "../../src/lib/rbac-roles";
import { requireIsolatedDatabase } from "../helpers/isolated-database";
import { physicalCheckoutFixture } from "../helpers/physical-checkout";

requireIsolatedDatabase();
jest.setTimeout(120_000);

medusaIntegrationTestRunner({
  inApp: true,
  dbName: "medusa-credo-refund-integration",
  testSuite: ({ api, getContainer, utils }) => {
    describe("recording Credo dashboard refunds", () => {
      const subjects: string[] = [];
      let gatewayRefund: Record<string, unknown>;
      const submissions: string[] = [];

      beforeEach(async () => {
        subjects.length = 0;
        submissions.length = 0;
        gatewayRefund = {
          id: 123,
          transaction: 777,
          amount: 50000,
          currency: "NGN",
          status: "processed",
        };
        await provisionRbacRoles(getContainer());
        jest.spyOn(global, "fetch").mockImplementation(async (url, options) => {
          const target = new URL(String(url));
          if (target.origin === "https://api.resend.com") {
            subjects.push(String(JSON.parse(String(options?.body)).subject));
            return new Response(JSON.stringify({ id: "re_refund" }));
          }
          if (target.origin !== "https://api.paystack.co")
            throw new Error("Unexpected external request in refund test");
          if (target.pathname === "/refund") {
            submissions.push("POST /refund");
            throw new Error(
              "Refund submission must never be retried or initiated here",
            );
          }
          if (target.pathname === "/refund/123")
            return new Response(
              JSON.stringify({ status: true, data: gatewayRefund }),
            );
          const body = options?.body ? JSON.parse(String(options.body)) : {};
          const reference =
            body.reference ??
            decodeURIComponent(target.pathname.split("/").at(-1)!);
          const data = target.pathname.startsWith("/transaction/verify/")
            ? {
                id: 777,
                reference,
                status: "success",
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

      /** A paid order; `credo` makes its payment a Credo one. */
      async function paidOrder({ credo }: { credo: boolean }) {
        const container = getContainer();
        const fixture = await physicalCheckoutFixture(container);
        const cart = await fixture.cart();
        const { result } = await completeCartWorkflow(container).run({
          input: { id: cart.id },
        });
        const {
          data: [order],
        } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
          entity: "order",
          fields: ["id", "payment_collections.payments.*"],
          filters: { id: result.id },
        });
        const payment = order.payment_collections![0]!.payments![0]!;
        if (credo) {
          await container
            .resolve<IPaymentModuleService>(Modules.PAYMENT)
            .updatePayment({
              id: payment.id,
              provider_id: "pp_credo_credo",
            } as Parameters<IPaymentModuleService["updatePayment"]>[0]);
        }
        return { orderId: order.id, paymentId: payment.id };
      }

      async function paymentState(paymentId: string) {
        const payment = await getContainer()
          .resolve<IPaymentModuleService>(Modules.PAYMENT)
          .retrievePayment(paymentId, { relations: ["refunds"] });
        return payment;
      }

      it("records a dashboard refund on the order and emails the customer", async () => {
        const { orderId, paymentId } = await paidOrder({ credo: true });
        const support = await login("role_support");

        // Medusa's own Refund can't pay a Credo refund out.
        await expect(
          api.post(
            `/admin/payments/${paymentId}/refund`,
            { amount: 100 },
            support,
          ),
        ).rejects.toMatchObject({
          response: {
            data: { message: expect.stringMatching(/Credo dashboard/) },
          },
        });

        await api.post(
          `/admin/orders/${orderId}/credo-refunds`,
          { payment_id: paymentId, amount: 500, reference: "CRD-REF-123" },
          support,
        );
        await utils.waitWorkflowExecutions();

        const payment = await paymentState(paymentId);
        expect(payment.refunds).toHaveLength(1);
        expect(payment.refunds![0]).toMatchObject({
          note: expect.stringContaining("CRD-REF-123"),
          created_by: expect.stringMatching(/^user_/),
        });
        expect(Number(payment.refunds![0].amount)).toBe(500);
        expect(payment.data!.dashboard_refund).toBeNull();
        expect(payment.data!.refund).toMatchObject({
          reference: "CRD-REF-123",
        });

        for (let attempt = 0; attempt < 40; attempt++) {
          if (subjects.some((subject) => /refund/i.test(subject))) break;
          await utils.waitWorkflowExecutions();
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        expect(subjects.some((subject) => /refund/i.test(subject))).toBe(true);
        const duplicate = await api.post(
          `/admin/orders/${orderId}/credo-refunds`,
          { payment_id: paymentId, amount: 500, reference: "crd-ref-123" },
          { ...support, validateStatus: () => true },
        );
        expect(duplicate.status).toBe(409);
        expect((await paymentState(paymentId)).refunds).toHaveLength(1);
      });

      it("records only a completed Paystack refund, once under concurrent requests", async () => {
        const { orderId, paymentId } = await paidOrder({ credo: false });
        const support = await login("role_support");
        const options = { ...support, validateStatus: () => true };
        const body = { payment_id: paymentId, amount: 500, reference: "123" };
        const ordinary = await api.post(
          `/admin/payments/${paymentId}/refund`,
          { amount: 500 },
          options,
        );
        expect(ordinary.status).toBe(400);
        for (const change of [
          { status: "pending" },
          { status: "failed" },
          { status: "processing" },
          { transaction: 888 },
          { currency: "USD" },
          { amount: 1 },
        ]) {
          const original = { ...gatewayRefund };
          gatewayRefund = { ...gatewayRefund, ...change };
          const rejected = await api.post(
            `/admin/orders/${orderId}/paystack-refunds`,
            body,
            options,
          );
          expect(rejected.status).toBe(400);
          expect((await paymentState(paymentId)).refunds ?? []).toHaveLength(0);
          gatewayRefund = original;
        }
        const responses = await Promise.all([
          api.post(`/admin/orders/${orderId}/paystack-refunds`, body, options),
          api.post(`/admin/orders/${orderId}/paystack-refunds`, body, options),
        ]);
        expect(responses.map((response) => response.status).sort()).toEqual([
          200, 409,
        ]);
        const payment = await paymentState(paymentId);
        expect(payment.refunds).toHaveLength(1);
        expect(payment.data?.refund).toMatchObject({
          id: 123,
          status: "processed",
        });
        expect(submissions).toEqual([]);
      });

      it("refuses too much, other gateways, and leaves no authorization behind", async () => {
        const { orderId, paymentId } = await paidOrder({ credo: true });
        const support = await login("role_support");

        await expect(
          api.post(
            `/admin/orders/${orderId}/credo-refunds`,
            { payment_id: paymentId, amount: 1_000_000, reference: "CRD-BIG" },
            support,
          ),
        ).rejects.toMatchObject({ response: { status: 400 } });
        const after = await paymentState(paymentId);
        expect(after.refunds ?? []).toHaveLength(0);
        expect(after.data!.dashboard_refund ?? null).toBeNull();

        await expect(
          api.post(
            `/admin/orders/${orderId}/credo-refunds`,
            { payment_id: "pay_elsewhere", amount: 100, reference: "CRD-X" },
            support,
          ),
        ).rejects.toMatchObject({ response: { status: 404 } });
      });

      it("only for Credo payments, and not for Marketing", async () => {
        const { orderId, paymentId } = await paidOrder({ credo: false });
        const support = await login("role_support");
        await expect(
          api.post(
            `/admin/orders/${orderId}/credo-refunds`,
            { payment_id: paymentId, amount: 100, reference: "CRD-PS" },
            support,
          ),
        ).rejects.toMatchObject({ response: { status: 400 } });

        const marketing = await login("role_marketing");
        await expect(
          api.post(
            `/admin/orders/${orderId}/credo-refunds`,
            { payment_id: paymentId, amount: 100, reference: "CRD-PS" },
            marketing,
          ),
        ).rejects.toMatchObject({ response: { status: 403 } });
      });
    });
  },
});
