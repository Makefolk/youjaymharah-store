import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import type { IApiKeyModuleService } from "@medusajs/framework/types";
import { createUsersWorkflow } from "@medusajs/medusa/core-flows";
import { provisionRbacRoles } from "../../src/lib/rbac-roles";
import { requireIsolatedDatabase } from "../helpers/isolated-database";

requireIsolatedDatabase();
jest.setTimeout(120_000);

medusaIntegrationTestRunner({
  inApp: true,
  dbName: "medusa-content-pages-integration",
  testSuite: ({ api, getContainer }) => {
    describe("About and Privacy pages", () => {
      let headers: Record<string, string>;

      beforeEach(async () => {
        await provisionRbacRoles(getContainer());
        const key = await getContainer()
          .resolve<IApiKeyModuleService>(Modules.API_KEY)
          .createApiKeys({
            title: "Pages test",
            type: "publishable",
            created_by: "test",
          });
        headers = { "x-publishable-api-key": key.token };
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

      it("publishes a page once it has text, and only then", async () => {
        await expect(
          api.get("/store/content-pages/about", { headers }),
        ).rejects.toMatchObject({ response: { status: 404 } });

        const manager = await login("role_store_manager");
        await api.post(
          "/admin/content-pages",
          { about: "## Our story\n\nMade in Lagos.", privacy: "   " },
          manager,
        );

        const { data } = await api.get("/store/content-pages/about", {
          headers,
        });
        expect(data.page).toEqual({
          name: "about",
          text: "## Our story\n\nMade in Lagos.",
        });
        const settings = await api.get("/store/storefront-settings", {
          headers,
        });
        expect(settings.data.settings.pages).toEqual({
          about: true,
          privacy: false,
          terms: false,
        });
        await expect(
          api.get("/store/content-pages/privacy", { headers }),
        ).rejects.toMatchObject({ response: { status: 404 } });
        await expect(
          api.get("/store/content-pages/cookies", { headers }),
        ).rejects.toMatchObject({ response: { status: 404 } });
      });

      it("lets Support read but not change them", async () => {
        const support = await login("role_support");
        const { data } = await api.get("/admin/content-pages", support);
        expect(data.pages).toEqual({ about: null, privacy: null, terms: null });
        await expect(
          api.post("/admin/content-pages", { about: "Hi" }, support),
        ).rejects.toMatchObject({ response: { status: 403 } });
      });
    });
  },
});
