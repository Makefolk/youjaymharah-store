import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import { createUsersWorkflow } from "@medusajs/medusa/core-flows";
import { requireIsolatedDatabase } from "../helpers/isolated-database";
import { provisionRbacRoles } from "../../src/lib/rbac-roles";
import { linkOrCreateCustomerAccountWorkflow } from "../../src/workflows/link-or-create-customer-account";

requireIsolatedDatabase();
jest.setTimeout(120_000);

medusaIntegrationTestRunner({
  inApp: true,
  dbName: "medusa-auth-security",
  testSuite: ({ api, getContainer, utils }) => {
    describe("authentication security", () => {
      let headers: Record<string, string>;
      beforeEach(async () => {
        jest.spyOn(global, "fetch").mockImplementation(async (url) => {
          const target = new URL(String(url));
          if (target.origin === "https://api.resend.com") {
            return new Response(JSON.stringify({ id: "audit-email" }));
          }
          throw new Error("Unexpected external request in isolated audit");
        });
        const key = await getContainer()
          .resolve(Modules.API_KEY)
          .createApiKeys({
            title: "Audit",
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

      async function register(
        email: string,
        password: string,
        customerEmail = email,
      ) {
        const {
          data: { token },
        } = await api.post("/auth/customer/emailpass/register", {
          email,
          password,
        });
        const {
          data: { customer },
        } = await api.post(
          "/store/customers",
          { email: customerEmail },
          { headers: { ...headers, authorization: `Bearer ${token}` } },
        );
        return customer;
      }

      it("enforces password lengths on direct registration", async () => {
        for (const password of ["x", "a".repeat(129)]) {
          const response = await api.post(
            "/auth/customer/emailpass/register",
            {
              email: "weak-audit@example.com",
              password,
            },
            { validateStatus: () => true },
          );
          expect(response.status).toBe(400);
        }
        await register("valid-audit@example.com", "valid-test-password");
      });

      it("keeps reset credentials out of notification lists and direct detail reads", async () => {
        const container = getContainer();
        await provisionRbacRoles(container);
        const auth = container.resolve(Modules.AUTH);
        for (const [email, role] of [
          ["owner-audit@example.com", "role_super_admin"],
          ["support-audit@example.com", "role_support"],
          ["manager-audit@example.com", "role_store_manager"],
        ]) {
          const { result: users } = await createUsersWorkflow(container).run({
            input: { users: [{ email, roles: [role] }] },
          });
          const { authIdentity } = await auth.register("emailpass", {
            body: { email, password: "initial-test-password" },
          });
          await auth.updateAuthIdentities({
            id: authIdentity!.id,
            app_metadata: { user_id: users[0].id },
          });
        }
        const {
          data: { token: supportToken },
        } = await api.post("/auth/user/emailpass", {
          email: "support-audit@example.com",
          password: "initial-test-password",
        });
        await api.post("/auth/user/emailpass/reset-password", {
          identifier: "owner-audit@example.com",
        });
        await utils.waitWorkflowExecutions();
        let emails: any[] = [];
        for (let attempt = 0; attempt < 40 && !emails.length; attempt++) {
          emails = await container
            .resolve(Modules.NOTIFICATION)
            .listNotifications({
              to: "owner-audit@example.com",
              channel: "email",
            });
          if (!emails.length)
            await new Promise((resolve) => setTimeout(resolve, 100));
        }
        expect(emails.length).toBeGreaterThan(0);
        const options = {
          headers: { authorization: `Bearer ${supportToken}` },
        };
        for (const query of [
          "",
          "?fields=id,to,channel,data",
          "?channel=email&fields=+data",
          "?$or[0][channel]=email",
        ]) {
          const { data } = await api.get(
            `/admin/notifications${query}`,
            options,
          );
          expect(data.notifications).toEqual([]);
          expect(data.count).toBe(0);
        }
        const detail = await api.get(
          `/admin/notifications/${emails[0].id}?fields=id,data`,
          {
            ...options,
            validateStatus: () => true,
          },
        );
        expect(detail.status).toBe(404);
        const login = await api.post("/auth/user/emailpass", {
          email: "owner-audit@example.com",
          password: "initial-test-password",
        });
        expect(login.data.token).toEqual(expect.any(String));
        const manager = await api.post("/auth/user/emailpass", {
          email: "manager-audit@example.com",
          password: "initial-test-password",
        });
        for (const path of [
          "/admin/workflows-executions?fields=id,context",
          "/admin/workflows-executions/missing",
        ]) {
          const response = await api.get(path, {
            headers: { authorization: `Bearer ${manager.data.token}` },
            validateStatus: () => true,
          });
          expect(response.status).toBe(403);
        }
        const owner = await api.get("/admin/workflows-executions", {
          headers: { authorization: `Bearer ${login.data.token}` },
        });
        expect(owner.status).toBe(200);
        const resetToken = new URL(emails[0].data.url).searchParams.get(
          "token",
        );
        const weakReset = await api.post(
          "/auth/user/emailpass/update",
          { password: "x" },
          {
            headers: { authorization: `Bearer ${resetToken}` },
            validateStatus: () => true,
          },
        );
        expect(weakReset.status).toBe(400);
      });

      it("throttles repeated failed logins and supplies a retry delay", async () => {
        await register("login-audit@example.com", "test-password-123");
        const statuses: number[] = [];
        for (let i = 0; i < 30; i++) {
          const response = await api.post(
            "/auth/customer/emailpass",
            { email: "login-audit@example.com", password: "wrong-password" },
            { validateStatus: () => true },
          );
          statuses.push(response.status);
          if (response.status === 429) {
            expect(Number(response.headers["retry-after"])).toBeGreaterThan(0);
          }
        }
        expect(statuses).toContain(401);
        expect(statuses).toContain(429);
      });

      it("refuses to merge Google into an unverified password account", async () => {
        const email = "precreated-audit@example.com";
        const customer = await register(email, "attacker-chosen-password");
        const auth = getContainer().resolve(Modules.AUTH);
        expect(customer.has_account).toBe(true);
        const existingIdentities = await auth.listAuthIdentities(
          { provider_identities: { provider: "emailpass", entity_id: email } },
          { relations: ["provider_identities"] },
        );
        expect(existingIdentities).toHaveLength(1);
        expect(existingIdentities[0].provider_identities?.[0].provider).toBe(
          "emailpass",
        );
        expect(
          await auth.listAuthVerifications({
            auth_identity_id: existingIdentities[0].id,
            entity_type: "email",
            entity_id: email,
          }),
        ).toEqual([]);
        const google = await auth.createAuthIdentities({
          provider_identities: [
            {
              provider: "google",
              entity_id: "isolated-google-subject",
              user_metadata: { email },
            },
          ],
        });
        const refused = await linkOrCreateCustomerAccountWorkflow(
          getContainer(),
        ).run({
          input: { auth_identity_id: google.id },
          throwOnError: false,
        });
        expect(refused.errors?.[0]?.error.message).toContain(
          "Verify your existing password account",
        );
        expect(refused.result?.customer_id).toBeFalsy();
        const unchanged = await auth.retrieveAuthIdentity(google.id);
        expect(unchanged.app_metadata?.customer_id).toBeFalsy();
        const [password] = await auth.listProviderIdentities({
          provider: "emailpass",
          entity_id: email,
        });
        const verification = await auth.requestAuthVerification({
          auth_identity_id: password.auth_identity_id!,
          entity_type: "email",
          entity_id: email,
          code_provider: "token",
        });
        await auth.confirmAuthVerification({
          code: verification.code!,
          code_provider: "token",
        });
        const { result } = await linkOrCreateCustomerAccountWorkflow(
          getContainer(),
        ).run({
          input: { auth_identity_id: google.id },
        });
        expect(result).toMatchObject({
          customer_id: customer.id,
          linked: true,
        });
      });

      it("refuses linking when a differently cased login cannot prove ownership", async () => {
        const email = "case-audit@example.com";
        await register("Case-Audit@example.com", "test-password-123", email);
        const auth = getContainer().resolve(Modules.AUTH);
        const google = await auth.createAuthIdentities({
          provider_identities: [
            {
              provider: "google",
              entity_id: "isolated-case-subject",
              user_metadata: { email },
            },
          ],
        });
        const refused = await linkOrCreateCustomerAccountWorkflow(
          getContainer(),
        ).run({
          input: { auth_identity_id: google.id },
          throwOnError: false,
        });
        expect(refused.errors?.[0]?.error.message).toContain(
          "Verify your existing password account",
        );
        expect(
          (await auth.retrieveAuthIdentity(google.id)).app_metadata
            ?.customer_id,
        ).toBeFalsy();
      });
    });
  },
});
