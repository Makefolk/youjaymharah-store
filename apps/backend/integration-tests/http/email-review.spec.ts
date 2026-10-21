import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import type { INotificationModuleService } from "@medusajs/framework/types";
import { createUsersWorkflow } from "@medusajs/medusa/core-flows";
import { provisionRbacRoles } from "../../src/lib/rbac-roles";
import { EMAIL_DELIVERY_MODULE } from "../../src/modules/email-delivery";
import type EmailDeliveryModuleService from "../../src/modules/email-delivery/service";
import { emailDeliveryId } from "../../src/modules/resend/delivery";
import { emailIdempotency } from "../../src/modules/resend/idempotency";
import { requireIsolatedDatabase } from "../helpers/isolated-database";

requireIsolatedDatabase();
jest.setTimeout(120_000);

medusaIntegrationTestRunner({
  inApp: true,
  dbName: "medusa-email-review-integration",
  testSuite: ({ api, getContainer }) => {
    describe("email review", () => {
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

      /** A send Resend never answered, as an outage leaves it. */
      async function uncertainSend(name: string) {
        const container = getContainer();
        global.fetch = jest.fn().mockRejectedValue(new Error("timeout"));
        const identity = emailIdempotency(`integration:${name}`);
        await container
          .resolve<INotificationModuleService>(Modules.NOTIFICATION)
          .createNotifications({
            to: `${name}@example.com`,
            channel: "email",
            template: "inline-support",
            resource_type: "order",
            resource_id: `order_${name}`,
            content: { html: "<p>Hello</p>", subject: "Your order" },
            ...identity,
          })
          .catch(() => undefined);
        global.fetch = originalFetch;
        return emailDeliveryId(identity.provider_data.idempotency_key);
      }

      it("lists uncertain sends and records a person's verdict", async () => {
        const ledger: EmailDeliveryModuleService = getContainer().resolve(
          EMAIL_DELIVERY_MODULE,
        );
        const blocked = await uncertainSend("blocked");
        const stalled = await uncertainSend("stalled");
        await ledger.updateEmailDeliveries([
          { id: blocked, status: "needs_review" },
          {
            id: stalled,
            first_attempt_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
          },
        ]);

        const support = await login("role_support");
        const { data } = await api.get("/admin/email-review", support);
        expect(data.count).toBe(2);
        expect(data.deliveries).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              id: blocked,
              state: "needs_review",
              template: "inline-support",
              to: "blocked@example.com",
              resource_id: "order_blocked",
            }),
            expect.objectContaining({ id: stalled, state: "stalled" }),
          ]),
        );

        // "Sent" needs Resend's ID for the email as evidence.
        await expect(
          api.post(
            `/admin/email-review/${blocked}/resolve`,
            { resolution: "sent" },
            support,
          ),
        ).rejects.toMatchObject({ response: { status: 400 } });

        const resendId = "4ef9a417-02e9-4d39-ad75-9611e0fcc33c";
        await api.post(
          `/admin/email-review/${blocked}/resolve`,
          { resolution: "sent", provider_id: resendId },
          support,
        );
        await api.post(
          `/admin/email-review/${stalled}/resolve`,
          { resolution: "not_sent", note: "Not in Resend's log" },
          support,
        );

        const [sent] = await ledger.listEmailDeliveries({ id: blocked });
        expect(sent).toMatchObject({
          status: "accepted",
          provider_id: resendId,
          resolution: "sent",
          payload_ciphertext: null,
        });
        expect(sent.resolved_by).toMatch(/^user_/);
        // Not sent stays blocked, so the old email can never go out late.
        const [notSent] = await ledger.listEmailDeliveries({ id: stalled });
        expect(notSent).toMatchObject({
          status: "needs_review",
          resolution: "not_sent",
          resolution_note: "Not in Resend's log",
        });

        expect((await api.get("/admin/email-review", support)).data).toEqual({
          deliveries: [],
          count: 0,
        });
        await expect(
          api.post(
            `/admin/email-review/${blocked}/resolve`,
            { resolution: "not_sent" },
            support,
          ),
        ).rejects.toMatchObject({ response: { status: 400 } });
      });

      it("keeps Marketing out", async () => {
        const marketing = await login("role_marketing");
        await expect(
          api.get("/admin/email-review", marketing),
        ).rejects.toMatchObject({ response: { status: 403 } });
      });
    });
  },
});
