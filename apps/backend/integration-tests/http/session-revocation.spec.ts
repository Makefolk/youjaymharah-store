import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import { createUsersWorkflow } from "@medusajs/medusa/core-flows";
import { requireIsolatedDatabase } from "../helpers/isolated-database";

requireIsolatedDatabase();
jest.setTimeout(120_000);

/** Cutoffs are whole seconds, like a token's `iat`. */
const nextSecond = () => new Promise((resolve) => setTimeout(resolve, 1100));

medusaIntegrationTestRunner({
  inApp: true,
  dbName: "medusa-session-revocation",
  testSuite: ({ api, getContainer, utils }) => {
    describe("ending earlier sign-ins", () => {
      let keyHeader: Record<string, string>;

      beforeEach(async () => {
        jest.spyOn(global, "fetch").mockImplementation(async (url) => {
          if (new URL(String(url)).origin === "https://api.resend.com") {
            return new Response(JSON.stringify({ id: "session-email" }));
          }
          throw new Error("Unexpected external request");
        });
        const key = await getContainer()
          .resolve(Modules.API_KEY)
          .createApiKeys({
            title: "Sessions",
            type: "publishable",
            created_by: "test",
          });
        keyHeader = { "x-publishable-api-key": key.token };
      });

      afterEach(async () => {
        await new Promise<void>((resolve) => setImmediate(resolve));
        await utils.waitWorkflowExecutions();
        jest.restoreAllMocks();
      });

      const bearer = (token: string) => ({
        headers: { ...keyHeader, authorization: `Bearer ${token}` },
        validateStatus: () => true,
      });

      async function customer(email: string, password: string) {
        const {
          data: { token },
        } = await api.post("/auth/customer/emailpass/register", {
          email,
          password,
        });
        await api.post("/store/customers", { email }, bearer(token));
        const { data } = await api.post("/auth/customer/emailpass", {
          email,
          password,
        });
        return data.token as string;
      }

      async function resetToken(to: string) {
        const notifications = getContainer().resolve(Modules.NOTIFICATION);
        for (let attempt = 0; attempt < 40; attempt++) {
          const [email] = await notifications.listNotifications({
            to,
            channel: "email",
          });
          if (email?.data?.url) {
            return new URL(String(email.data.url)).searchParams.get("token")!;
          }
          await new Promise((resolve) => setTimeout(resolve, 100));
        }
        throw new Error(`No reset email for ${to}`);
      }

      it("changing the password ends other sign-ins and hands back a working token", async () => {
        const email = "change-sessions@example.com";
        const elsewhere = await customer(email, "old-password-123");
        await nextSecond();

        const { data, status } = await api.post(
          "/store/customers/me/password/change",
          {
            current_password: "old-password-123",
            new_password: "new-password-456",
          },
          bearer(elsewhere),
        );
        expect(status).toBe(200);
        expect(data.token).toEqual(expect.any(String));

        expect(
          (await api.get("/store/customers/me", bearer(elsewhere))).status,
        ).toBe(401);
        expect(
          (await api.post("/auth/token/refresh", {}, bearer(elsewhere))).status,
        ).toBe(401);
        // An ended token still browses, as a guest.
        expect(
          (await api.get("/store/regions", bearer(elsewhere))).status,
        ).toBe(200);

        const me = await api.get("/store/customers/me", bearer(data.token));
        expect(me.status).toBe(200);
        expect(me.data.customer.email).toBe(email);
      });

      it("finishing a reset ends every earlier customer sign-in", async () => {
        const email = "reset-sessions@example.com";
        const stolen = await customer(email, "first-password-123");
        await nextSecond();

        await api.post("/auth/customer/emailpass/reset-password", {
          identifier: email,
        });
        await utils.waitWorkflowExecutions();
        const reset = await api.post(
          "/auth/customer/emailpass/update",
          { password: "second-password-456" },
          {
            headers: { authorization: `Bearer ${await resetToken(email)}` },
            validateStatus: () => true,
          },
        );
        expect(reset.status).toBe(200);

        expect(
          (await api.get("/store/customers/me", bearer(stolen))).status,
        ).toBe(401);
        const { data } = await api.post("/auth/customer/emailpass", {
          email,
          password: "second-password-456",
        });
        expect(
          (await api.get("/store/customers/me", bearer(data.token))).status,
        ).toBe(200);
      });

      it("finishing a reset ends admin sessions and tokens", async () => {
        const container = getContainer();
        const email = "admin-sessions@example.com";
        const { result: users } = await createUsersWorkflow(container).run({
          input: { users: [{ email }] },
        });
        const auth = container.resolve(Modules.AUTH);
        const { authIdentity } = await auth.register("emailpass", {
          body: { email, password: "admin-password-123" },
        });
        await auth.updateAuthIdentities({
          id: authIdentity!.id,
          app_metadata: { user_id: users[0].id },
        });

        const {
          data: { token },
        } = await api.post("/auth/user/emailpass", {
          email,
          password: "admin-password-123",
        });
        const session = await api.post(
          "/auth/session",
          {},
          { headers: { authorization: `Bearer ${token}` } },
        );
        const cookie = String(session.headers["set-cookie"]?.[0]).split(";")[0];
        const withCookie = { headers: { cookie }, validateStatus: () => true };
        expect((await api.get("/admin/users/me", withCookie)).status).toBe(200);
        await nextSecond();

        await api.post("/auth/user/emailpass/reset-password", {
          identifier: email,
        });
        await utils.waitWorkflowExecutions();
        await api.post(
          "/auth/user/emailpass/update",
          { password: "admin-password-456" },
          { headers: { authorization: `Bearer ${await resetToken(email)}` } },
        );

        expect((await api.get("/admin/users/me", withCookie)).status).toBe(401);
        expect(
          (
            await api.get("/admin/users/me", {
              headers: { authorization: `Bearer ${token}` },
              validateStatus: () => true,
            })
          ).status,
        ).toBe(401);
        const fresh = await api.post("/auth/user/emailpass", {
          email,
          password: "admin-password-456",
        });
        expect(
          (
            await api.get("/admin/users/me", {
              headers: { authorization: `Bearer ${fresh.data.token}` },
            })
          ).status,
        ).toBe(200);
      });

      it("signs a customer out of all devices on request", async () => {
        const token = await customer("everywhere@example.com", "password-123");
        await nextSecond();

        const out = await api.delete(
          "/store/customers/me/sessions",
          bearer(token),
        );
        expect(out.status).toBe(200);
        expect(
          (await api.get("/store/customers/me", bearer(token))).status,
        ).toBe(401);
      });
    });
  },
});
