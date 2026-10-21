import { createHmac } from "node:crypto";
import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { createUsersWorkflow } from "@medusajs/medusa/core-flows";
import { Modules } from "@medusajs/framework/utils";
import type {
  ICustomerModuleService,
  INotificationModuleService,
} from "@medusajs/framework/types";
import { provisionRbacRoles } from "../../src/lib/rbac-roles";
import { EMAIL_DELIVERY_MODULE } from "../../src/modules/email-delivery";
import type EmailDeliveryModuleService from "../../src/modules/email-delivery/service";
import { emailIdempotency } from "../../src/modules/resend/idempotency";
import { requireIsolatedDatabase } from "../helpers/isolated-database";

requireIsolatedDatabase();
jest.setTimeout(120_000);

const secretBytes = Buffer.from("isolated-support-webhook-secret");
const secret = `whsec_${secretBytes.toString("base64")}`;

medusaIntegrationTestRunner({
  inApp: true,
  dbName: "medusa-support-context-integration",
  env: { RESEND_WEBHOOK_SECRET: secret },
  testSuite: ({ api, getContainer }) => {
    describe("support context and email delivery outcomes", () => {
      const originalFetch = global.fetch;
      afterEach(() => {
        global.fetch = originalFetch;
      });
      beforeEach(async () => {
        await provisionRbacRoles(getContainer());
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

      function webhook(event: Record<string, unknown>, id: string) {
        const raw = JSON.stringify(event);
        const timestamp = String(Math.floor(Date.now() / 1000));
        const signature = createHmac("sha256", secretBytes)
          .update(`${id}.${timestamp}.${raw}`)
          .digest("base64");
        return api.post("/webhooks/resend", raw, {
          transformRequest: [(body: string) => body],
          headers: {
            "Content-Type": "application/json",
            "svix-id": id,
            "svix-timestamp": timestamp,
            "svix-signature": `v1,${signature}`,
          },
        });
      }

      it("shows Support a customer's bounced email with the server's reason", async () => {
        const container = getContainer();
        const customers: ICustomerModuleService = container.resolve(
          Modules.CUSTOMER,
        );
        const customer = await customers.createCustomers({
          email: "buyer@example.com",
        });

        global.fetch = jest
          .fn()
          .mockImplementation(
            async () => new Response(JSON.stringify({ id: "re_support_1" })),
          );
        const notifications: INotificationModuleService = container.resolve(
          Modules.NOTIFICATION,
        );
        await notifications.createNotifications({
          to: "buyer@example.com",
          channel: "email",
          template: "inline-support",
          content: { html: "<p>Hello</p>", subject: "Support" },
          ...emailIdempotency("integration:support"),
        });
        global.fetch = originalFetch;

        await webhook(
          {
            type: "email.bounced",
            created_at: new Date().toISOString(),
            data: {
              email_id: "re_support_1",
              to: ["buyer@example.com"],
              bounce: {
                type: "Permanent",
                subType: "General",
                message: "550 buyer@example.com does not exist",
              },
            },
          },
          "msg_support_bounce",
        );

        const deliveries: EmailDeliveryModuleService = container.resolve(
          EMAIL_DELIVERY_MODULE,
        );
        const [delivery] = await deliveries.listEmailDeliveries({
          provider_id: "re_support_1",
        });
        expect(delivery.outcome).toBe("bounced");

        const auth = await login("role_support");
        const { data } = await api.get(
          `/admin/customers/${customer.id}/support-context`,
          auth,
        );
        expect(data.emails).toEqual([
          expect.objectContaining({
            template: "inline-support",
            status: "sent",
            outcome: "bounced",
            outcome_detail: "Permanent / General: 550 [email] does not exist",
          }),
        ]);
        expect(data.wishlist).toEqual({ count: 0, items: [] });
        expect(data.cart_reminders.opted_out).toBe(false);
      });

      it("returns 404 for unknown orders and customers", async () => {
        const auth = await login("role_support");
        await expect(
          api.get("/admin/orders/order_missing/emails", auth),
        ).rejects.toMatchObject({ response: { status: 404 } });
        await expect(
          api.post(
            "/admin/orders/order_missing/emails/resend-confirmation",
            {},
            auth,
          ),
        ).rejects.toMatchObject({ response: { status: 404 } });
        await expect(
          api.get("/admin/customers/cus_missing/support-context", auth),
        ).rejects.toMatchObject({ response: { status: 404 } });
      });

      it("keeps support details from Marketing", async () => {
        const auth = await login("role_marketing");
        await expect(
          api.get("/admin/orders/order_any/emails", auth),
        ).rejects.toMatchObject({ response: { status: 403 } });
        await expect(
          api.get("/admin/customers/cus_any/support-context", auth),
        ).rejects.toMatchObject({ response: { status: 403 } });
      });
    });
  },
});
