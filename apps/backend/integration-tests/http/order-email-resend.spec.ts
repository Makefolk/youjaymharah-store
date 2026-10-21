import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  completeCartWorkflow,
  createOrderFulfillmentWorkflow,
  createOrderShipmentWorkflow,
  createUsersWorkflow,
} from "@medusajs/medusa/core-flows";
import { provisionRbacRoles } from "../../src/lib/rbac-roles";
import { requireIsolatedDatabase } from "../helpers/isolated-database";
import { physicalCheckoutFixture } from "../helpers/physical-checkout";

requireIsolatedDatabase();
jest.setTimeout(120_000);

medusaIntegrationTestRunner({
  inApp: true,
  dbName: "medusa-order-email-resend-integration",
  testSuite: ({ api, getContainer, utils }) => {
    describe("resending an order's shipping email", () => {
      const sentEmails: { to: string; subject: string }[] = [];

      beforeEach(async () => {
        sentEmails.length = 0;
        await provisionRbacRoles(getContainer());
        jest.spyOn(global, "fetch").mockImplementation(async (url, options) => {
          const target = new URL(String(url));
          if (target.origin === "https://api.resend.com") {
            const body = JSON.parse(String(options?.body));
            sentEmails.push({ to: String(body.to), subject: body.subject });
            return new Response(
              JSON.stringify({ id: `re_${sentEmails.length}` }),
            );
          }
          if (target.origin !== "https://api.paystack.co")
            throw new Error("Unexpected external request in resend test");
          const body = options?.body ? JSON.parse(String(options.body)) : {};
          const reference =
            body.reference ??
            decodeURIComponent(target.pathname.split("/").at(-1)!);
          const data = target.pathname.startsWith("/transaction/verify/")
            ? { reference, status: "success", currency: "NGN", amount: 129000 }
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
        const { authIdentity, error } = await auth.register("emailpass", {
          body: { email, password },
        });
        if (error || !authIdentity)
          throw new Error("Could not register test identity");
        await auth.updateAuthIdentities({
          id: authIdentity.id,
          app_metadata: { user_id: users[0].id },
        });
        const { data } = await api.post("/auth/user/emailpass", {
          email,
          password,
        });
        return { headers: { Authorization: `Bearer ${data.token}` } };
      }

      async function fulfilledOrder({ ship }: { ship: boolean }) {
        const container = getContainer();
        const fixture = await physicalCheckoutFixture(container);
        const cart = await fixture.cart();
        const { result } = await completeCartWorkflow(container).run({
          input: { id: cart.id },
        });
        const query = container.resolve(ContainerRegistrationKeys.QUERY);
        const {
          data: [order],
        } = await query.graph({
          entity: "order",
          fields: ["id", "email", "items.id"],
          filters: { id: result.id },
        });
        const items = [{ id: order.items![0]!.id, quantity: 1 }];
        const { result: fulfillment } = await createOrderFulfillmentWorkflow(
          container,
        ).run({
          input: { order_id: order.id, location_id: fixture.locationId, items },
        });
        if (ship) {
          await createOrderShipmentWorkflow(container).run({
            input: {
              order_id: order.id,
              fulfillment_id: fulfillment.id,
              items,
              labels: [
                {
                  tracking_number: "TRACK-123",
                  tracking_url: "https://track.example/TRACK-123",
                  label_url: "https://track.example/label",
                },
              ],
            },
          });
        }
        await utils.waitWorkflowExecutions();
        return { order, fulfillmentId: fulfillment.id };
      }

      it("sends the shipment's email again, as a new email each time", async () => {
        const { order, fulfillmentId } = await fulfilledOrder({ ship: true });
        const auth = await login("role_support");
        const shippedBefore = sentEmails.filter((email) =>
          /ship/i.test(email.subject),
        ).length;

        for (let attempt = 0; attempt < 2; attempt++) {
          const { data } = await api.post(
            `/admin/orders/${order.id}/emails/resend-shipping`,
            { fulfillment_id: fulfillmentId },
            auth,
          );
          expect(data).toEqual({ sent_to: order.email, pending: false });
        }

        const shipped = sentEmails.filter((email) =>
          /ship/i.test(email.subject),
        );
        expect(shipped).toHaveLength(shippedBefore + 2);
        expect(shipped.at(-1)!.to).toContain(order.email);
      });

      it("refuses unshipped shipments and shipments not on the order", async () => {
        const unshipped = await fulfilledOrder({ ship: false });
        const auth = await login("role_support");

        await expect(
          api.post(
            `/admin/orders/${unshipped.order.id}/emails/resend-shipping`,
            { fulfillment_id: unshipped.fulfillmentId },
            auth,
          ),
        ).rejects.toMatchObject({ response: { status: 400 } });

        await expect(
          api.post(
            `/admin/orders/${unshipped.order.id}/emails/resend-shipping`,
            // Not among this order's fulfillments, as another order's isn't.
            { fulfillment_id: "ful_of_another_order" },
            auth,
          ),
        ).rejects.toMatchObject({ response: { status: 404 } });
      });

      it("keeps Marketing from resending", async () => {
        const { order, fulfillmentId } = await fulfilledOrder({ ship: true });
        const auth = await login("role_marketing");
        await expect(
          api.post(
            `/admin/orders/${order.id}/emails/resend-shipping`,
            { fulfillment_id: fulfillmentId },
            auth,
          ),
        ).rejects.toMatchObject({ response: { status: 403 } });
      });
    });
  },
});
