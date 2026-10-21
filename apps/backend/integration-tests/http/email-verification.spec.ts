import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import type { IApiKeyModuleService } from "@medusajs/framework/types";
import {
  completeCartWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows";
import { requireIsolatedDatabase } from "../helpers/isolated-database";
import { physicalCheckoutFixture } from "../helpers/physical-checkout";

requireIsolatedDatabase();
jest.setTimeout(120_000);

const GUEST_EMAIL = "physical-checkout@example.com";

medusaIntegrationTestRunner({
  inApp: true,
  dbName: "medusa-email-verification-integration",
  testSuite: ({ api, getContainer, utils }) => {
    describe("email verification links guest orders", () => {
      let keyHeader: Record<string, string>;
      const verifyLinks: string[] = [];

      beforeEach(async () => {
        verifyLinks.length = 0;
        jest.spyOn(global, "fetch").mockImplementation(async (url, options) => {
          const target = new URL(String(url));
          if (target.origin === "https://api.resend.com") {
            const body = JSON.parse(String(options?.body));
            const link = String(body.html ?? "").match(
              /account\/verify\?token=([^"&<\s]+)/,
            );
            if (link) verifyLinks.push(decodeURIComponent(link[1]));
            return new Response(JSON.stringify({ id: "re_verify" }));
          }
          if (target.origin !== "https://api.paystack.co")
            throw new Error("Unexpected external request in verification test");
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

      async function placeGuestOrder() {
        const container = getContainer();
        const fixture = await physicalCheckoutFixture(container);
        const cart = await fixture.cart();
        const { result } = await completeCartWorkflow(container).run({
          input: { id: cart.id },
        });
        // The storefront's key must reach the fixture's sales channel.
        const {
          data: [withChannel],
        } = await container.resolve("query").graph({
          entity: "cart",
          fields: ["sales_channel_id"],
          filters: { id: cart.id },
        });
        const key = await container
          .resolve<IApiKeyModuleService>(Modules.API_KEY)
          .createApiKeys({
            title: "Verification test",
            type: "publishable",
            created_by: "test",
          });
        await linkSalesChannelsToApiKeyWorkflow(container).run({
          input: { id: key.id, add: [withChannel.sales_channel_id!] },
        });
        keyHeader = { "x-publishable-api-key": key.token };
        return result.id;
      }

      async function registerCustomer(email: string) {
        const password = "isolated-test-password-only";
        const {
          data: { token: registration },
        } = await api.post("/auth/customer/emailpass/register", {
          email,
          password,
        });
        await api.post(
          "/store/customers",
          { email },
          {
            headers: {
              ...keyHeader,
              Authorization: `Bearer ${registration}`,
            },
          },
        );
        const {
          data: { token },
        } = await api.post("/auth/customer/emailpass", { email, password });
        return { headers: { ...keyHeader, Authorization: `Bearer ${token}` } };
      }

      /** The email goes out from a subscriber, a moment after the request. */
      async function nextVerifyLink(count: number) {
        for (let attempt = 0; attempt < 40; attempt++) {
          await utils.waitWorkflowExecutions();
          if (verifyLinks.length >= count) return verifyLinks[count - 1];
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
        throw new Error("No verification email was sent");
      }

      async function orderIds(auth: { headers: Record<string, string> }) {
        const { data } = await api.get("/store/orders?fields=id", auth);
        return data.orders.map((order: { id: string }) => order.id);
      }

      it("moves the guest orders in once the account's email is verified", async () => {
        const orderId = await placeGuestOrder();
        const auth = await registerCustomer(GUEST_EMAIL);

        expect(await orderIds(auth)).toEqual([]);
        expect(
          (await api.get("/store/customers/me/email-verification", auth)).data,
        ).toEqual({ email: GUEST_EMAIL, verified: false });

        const { data: sent } = await api.post(
          "/store/customers/me/email-verification",
          {},
          auth,
        );
        expect(sent).toMatchObject({ sent: true, verified: false });
        const token = await nextVerifyLink(1);

        const { data: confirmed } = await api.post(
          "/store/customers/verify-email",
          { token },
          { headers: keyHeader },
        );
        expect(confirmed).toEqual({ email: GUEST_EMAIL, verified: true });

        let ids: string[] = [];
        for (let attempt = 0; attempt < 40 && !ids.length; attempt++) {
          await utils.waitWorkflowExecutions();
          ids = await orderIds(auth);
          if (!ids.length) await new Promise((r) => setTimeout(r, 250));
        }
        expect(ids).toEqual([orderId]);
        expect(
          (await api.get("/store/customers/me/email-verification", auth)).data
            .verified,
        ).toBe(true);

        // A link works once.
        await expect(
          api.post(
            "/store/customers/verify-email",
            { token },
            { headers: keyHeader },
          ),
        ).rejects.toMatchObject({ response: { status: 400 } });
      });

      it("refuses a link for an address the account no longer uses", async () => {
        await placeGuestOrder();
        const auth = await registerCustomer("first-address@example.com");
        await api.post("/store/customers/me/email-verification", {}, auth);
        const token = await nextVerifyLink(1);

        // The account moves to the guest order's address before the click.
        const customers = getContainer().resolve(Modules.CUSTOMER);
        const [customer] = await customers.listCustomers({
          email: "first-address@example.com",
        });
        await customers.updateCustomers(customer.id, { email: GUEST_EMAIL });

        await expect(
          api.post(
            "/store/customers/verify-email",
            { token },
            { headers: keyHeader },
          ),
        ).rejects.toMatchObject({ response: { status: 400 } });
        await utils.waitWorkflowExecutions();
        expect(await orderIds(auth)).toEqual([]);
      });
    });
  },
});
