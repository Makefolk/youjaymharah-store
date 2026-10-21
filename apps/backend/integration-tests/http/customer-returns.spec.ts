import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import type {
  IApiKeyModuleService,
  IOrderModuleService,
} from "@medusajs/framework/types";
import {
  completeCartWorkflow,
  createOrderFulfillmentWorkflow,
  markOrderFulfillmentAsDeliveredWorkflow,
} from "@medusajs/medusa/core-flows";
import { requireIsolatedDatabase } from "../helpers/isolated-database";
import { physicalCheckoutFixture } from "../helpers/physical-checkout";

requireIsolatedDatabase();
jest.setTimeout(120_000);

medusaIntegrationTestRunner({
  inApp: true,
  dbName: "medusa-customer-returns-integration",
  testSuite: ({ api, getContainer, utils }) => {
    describe("customer order lookup and return requests", () => {
      let headers: Record<string, string>;
      const sentEmails: string[] = [];
      const returnLinks: string[] = [];

      beforeEach(async () => {
        sentEmails.length = 0;
        returnLinks.length = 0;
        jest.spyOn(global, "fetch").mockImplementation(async (url, options) => {
          const target = new URL(String(url));
          if (target.origin === "https://api.resend.com") {
            const email = JSON.parse(String(options?.body));
            sentEmails.push(String(email.subject));
            const access = String(email.html ?? "").match(
              /return\?access=([^"&<\s]+)/,
            );
            if (access) returnLinks.push(decodeURIComponent(access[1]));
            return new Response(JSON.stringify({ id: "returns-test-email" }));
          }
          if (target.origin !== "https://api.paystack.co")
            throw new Error("Unexpected external request in returns test");
          const body = options?.body ? JSON.parse(String(options.body)) : {};
          const reference =
            body.reference ??
            decodeURIComponent(target.pathname.split("/").at(-1)!);
          const data = target.pathname.startsWith("/transaction/verify/")
            ? { reference, status: "success", currency: "NGN", amount: 129000 }
            : { reference, authorization_url: "https://example.com/pay" };
          return new Response(JSON.stringify({ status: true, data }));
        });
        const keys: IApiKeyModuleService = getContainer().resolve(
          Modules.API_KEY,
        );
        const key = await keys.createApiKeys({
          title: "Returns test",
          type: "publishable",
          created_by: "test",
        });
        headers = { "x-publishable-api-key": key.token };
      });

      afterEach(async () => {
        await new Promise<void>((resolve) => setImmediate(resolve));
        await utils.waitWorkflowExecutions();
        jest.restoreAllMocks();
      });

      async function deliveredOrder() {
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
          fields: ["id", "display_id", "email", "items.id"],
          filters: { id: result.id },
        });
        const { result: fulfillment } = await createOrderFulfillmentWorkflow(
          container,
        ).run({
          input: {
            order_id: order.id,
            location_id: fixture.locationId,
            items: [{ id: order.items![0]!.id, quantity: 1 }],
          },
        });
        await markOrderFulfillmentAsDeliveredWorkflow(container).run({
          input: { orderId: order.id, fulfillmentId: fulfillment.id },
        });
        return order;
      }

      it("finds an order only from its number and the matching email", async () => {
        const order = await deliveredOrder();
        const found = await api.post(
          "/store/order-lookup",
          {
            email: "PHYSICAL-checkout@example.com",
            display_id: order.display_id,
          },
          { headers },
        );
        expect(found.data).toEqual({ order: { id: order.id } });
        await expect(
          api.post(
            "/store/order-lookup",
            { email: "someone-else@example.com", display_id: order.display_id },
            { headers },
          ),
        ).rejects.toMatchObject({ response: { status: 404 } });
      });

      it("lets a guest request a return within the window, once", async () => {
        const order = await deliveredOrder();
        const itemId = order.items![0]!.id;
        const orders: IOrderModuleService = getContainer().resolve(
          Modules.ORDER,
        );
        const [reason] = await orders.createReturnReasons([
          { value: "too_small", label: "Too small" },
        ]);

        const options = await api.get(
          `/store/orders/${order.id}/return-options`,
          { headers },
        );
        expect(options.data.return_policy).toEqual({
          enabled: true,
          window_days: 7,
        });
        expect(options.data.eligibility).toMatchObject({
          open: true,
          items: [{ item_id: itemId, returnable_quantity: 1 }],
        });

        // Knowing the order's email is no proof: the order's link shows it.
        await expect(
          api.post(
            `/store/orders/${order.id}/return-requests`,
            { email: order.email, items: [{ id: itemId, quantity: 1 }] },
            { headers },
          ),
        ).rejects.toMatchObject({ response: { status: 400 } });

        const sent = await api.post(
          `/store/orders/${order.id}/return-access`,
          {},
          { headers },
        );
        expect(sent.data.sent_to).toMatch(/^.•••@example\.com$/);
        let access: string | undefined;
        for (let attempt = 0; attempt < 40 && !access; attempt++) {
          await utils.waitWorkflowExecutions();
          access = returnLinks[0];
          if (!access) await new Promise((r) => setTimeout(r, 250));
        }
        expect(access).toBeDefined();

        await expect(
          api.post(
            `/store/orders/${order.id}/return-requests`,
            { access: `${access}x`, items: [{ id: itemId, quantity: 1 }] },
            { headers },
          ),
        ).rejects.toMatchObject({ response: { status: 400 } });

        const requested = await api.post(
          `/store/orders/${order.id}/return-requests`,
          {
            access,
            items: [{ id: itemId, quantity: 1, reason_id: reason.id }],
            note: "Runs small",
          },
          { headers },
        );
        expect(requested.data.return.id).toMatch(/^return_/);

        const after = await api.get(
          `/store/orders/${order.id}/return-options`,
          { headers },
        );
        expect(after.data.eligibility).toMatchObject({
          open: false,
          reason: "nothing_left",
        });
        expect(after.data.returns).toEqual([
          expect.objectContaining({
            id: requested.data.return.id,
            status: "requested",
            items: [{ item_id: itemId, quantity: 1 }],
          }),
        ]);

        await expect(
          api.post(
            `/store/orders/${order.id}/return-requests`,
            { access, items: [{ id: itemId, quantity: 1 }] },
            { headers },
          ),
        ).rejects.toMatchObject({ response: { status: 400 } });
      });

      it("refuses Medusa's own return route, which skips every check", async () => {
        const order = await deliveredOrder();
        const settings = getContainer().resolve("storefrontSettings");
        const row = await settings.retrieveSettings();
        await settings.updateStorefrontSettings([
          { id: row.id, returns_enabled: false },
        ]);

        await expect(
          api.post(
            "/store/returns",
            {
              order_id: order.id,
              items: [{ id: order.items![0]!.id, quantity: 1 }],
              return_shipping: { option_id: "so_any" },
              receive_now: true,
            },
            { headers },
          ),
        ).rejects.toMatchObject({ response: { status: 404 } });

        const {
          data: [after],
        } = await getContainer()
          .resolve(ContainerRegistrationKeys.QUERY)
          .graph({
            entity: "order",
            fields: ["returns.id"],
            filters: { id: order.id },
          });
        expect(after.returns ?? []).toEqual([]);
      });

      it("closes returns when the store turns them off", async () => {
        const order = await deliveredOrder();
        const { data } = await api.get("/store/storefront-settings", {
          headers,
        });
        expect(data.settings.returns).toEqual({
          enabled: true,
          window_days: 7,
        });

        const settings = getContainer().resolve("storefrontSettings");
        const row = await settings.retrieveSettings();
        await settings.updateStorefrontSettings([
          { id: row.id, returns_enabled: false },
        ]);

        const options = await api.get(
          `/store/orders/${order.id}/return-options`,
          { headers },
        );
        expect(options.data.eligibility).toMatchObject({
          open: false,
          reason: "disabled",
        });
      });
    });
  },
});
