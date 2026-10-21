import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { createUsersWorkflow } from "@medusajs/medusa/core-flows";
import { provisionRbacRoles } from "../../src/lib/rbac-roles";
import { requireIsolatedDatabase } from "../helpers/isolated-database";
import { physicalCheckoutFixture } from "../helpers/physical-checkout";

requireIsolatedDatabase();
jest.setTimeout(120_000);

medusaIntegrationTestRunner({
  inApp: true,
  dbName: "medusa-payment-lookup-integration",
  testSuite: ({ api, getContainer, utils }) => {
    describe("support payment lookup", () => {
      let initialized: Map<string, number>;
      let gatewayStatus: string;

      beforeEach(async () => {
        initialized = new Map();
        gatewayStatus = "success";
        jest.spyOn(global, "fetch").mockImplementation(async (url, options) => {
          const target = new URL(String(url));
          if (target.origin === "https://api.resend.com")
            return new Response(JSON.stringify({ id: "lookup-test-email" }));
          if (target.origin !== "https://api.paystack.co")
            throw new Error("Unexpected external request in lookup test");
          let data: Record<string, unknown>;
          if (target.pathname === "/transaction/initialize") {
            const body = JSON.parse(String(options?.body));
            initialized.set(body.reference, Number(body.amount));
            data = {
              reference: body.reference,
              authorization_url: "https://checkout.paystack.com/test",
            };
          } else {
            const reference = decodeURIComponent(
              target.pathname.split("/").at(-1)!,
            );
            data = {
              reference,
              status: gatewayStatus,
              currency: "NGN",
              amount: initialized.get(reference),
            };
          }
          return new Response(JSON.stringify({ status: true, data }));
        });
        await provisionRbacRoles(getContainer());
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

      /** A shopper who paid on Paystack and never came back. */
      async function abandonedPaidCart() {
        const fixture = await physicalCheckoutFixture(getContainer());
        const cart = await fixture.cart();
        const session = await getContainer()
          .resolve(Modules.PAYMENT)
          .retrievePaymentSession(cart.sessionId);
        return { cart, reference: session.data.reference as string };
      }

      it("finds a paid cart without an order and lets Support create the order", async () => {
        const { cart, reference } = await abandonedPaidCart();
        const auth = await login("role_support");

        const { data: lookup } = await api.get(
          `/admin/payment-lookup?reference=${reference}`,
          auth,
        );
        expect(lookup).toMatchObject({
          verdict: "paid_no_order",
          gateway: { checked: true, status: "successful" },
          attempt: {
            reference,
            provider_id: "pp_paystack_paystack",
            cart: { id: cart.id, email: "physical-checkout@example.com" },
            order: null,
          },
        });

        const { data: attempts } = await api.get(
          "/admin/payment-lookup?email=physical-checkout@example.com",
          auth,
        );
        expect(attempts.attempts.map((a: any) => a.reference)).toContain(
          reference,
        );

        const { data: created } = await api.post(
          "/admin/payment-lookup/create-order",
          { session_id: lookup.attempt.session_id },
          auth,
        );
        expect(created.order.display_id).toEqual(expect.any(Number));

        const { data: after } = await api.get(
          `/admin/payment-lookup?reference=${reference}`,
          auth,
        );
        expect(after.verdict).toBe("order_placed");
        expect(after.attempt.order.id).toBe(created.order.id);

        await expect(
          api.post(
            "/admin/payment-lookup/create-order",
            { session_id: lookup.attempt.session_id },
            auth,
          ),
        ).rejects.toMatchObject({ response: { status: 400 } });
      });

      it("refuses to create an order the gateway says wasn't paid", async () => {
        const { reference } = await abandonedPaidCart();
        gatewayStatus = "abandoned";
        const auth = await login("role_support");

        const { data } = await api.get(
          `/admin/payment-lookup?reference=${reference}`,
          auth,
        );
        expect(data.verdict).toBe("not_paid");

        await expect(
          api.post(
            "/admin/payment-lookup/create-order",
            { session_id: data.attempt.session_id },
            auth,
          ),
        ).rejects.toMatchObject({ response: { status: 400 } });

        const { data: orders } = await getContainer()
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({ entity: "order", fields: ["id"] });
        expect(orders).toHaveLength(0);
      });

      it("explains unknown references and keeps payments from Marketing", async () => {
        const support = await login("role_support");
        await expect(
          api.get("/admin/payment-lookup?reference=T123456789", support),
        ).rejects.toMatchObject({ response: { status: 404 } });
        await expect(
          api.get("/admin/payment-lookup", support),
        ).rejects.toMatchObject({ response: { status: 400 } });

        const marketing = await login("role_marketing");
        await expect(
          api.get("/admin/payment-lookup?email=a@b.co", marketing),
        ).rejects.toMatchObject({ response: { status: 403 } });
      });
    });
  },
});
