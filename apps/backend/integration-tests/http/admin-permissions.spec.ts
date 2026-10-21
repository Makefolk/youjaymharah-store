import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { createUsersWorkflow } from "@medusajs/medusa/core-flows";
import { Modules } from "@medusajs/framework/utils";
import { provisionRbacRoles } from "../../src/lib/rbac-roles";
import { NEWSLETTER_MODULE } from "../../src/modules/newsletter";
import type NewsletterModuleService from "../../src/modules/newsletter/service";
import { requireIsolatedDatabase } from "../helpers/isolated-database";

requireIsolatedDatabase();
jest.setTimeout(120_000);

medusaIntegrationTestRunner({
  inApp: true,
  dbName: "medusa-admin-permissions-integration",
  testSuite: ({ api, getContainer }) => {
    describe("custom admin API permissions", () => {
      beforeEach(async () => {
        await provisionRbacRoles(getContainer());
      });

      async function login(role: string | null) {
        const container = getContainer();
        const email = `${role ?? "roleless"}@example.com`;
        const password = "isolated-test-password-only";
        const { result: users } = await createUsersWorkflow(container).run({
          input: { users: [{ email, roles: role ? [role] : [] }] },
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

      it("allows Marketing newsletter management but denies branding writes and customer data", async () => {
        const auth = await login("role_marketing");
        expect((await api.get("/admin/newsletter/settings", auth)).status).toBe(
          200,
        );
        expect(
          (
            await api.post(
              "/admin/newsletter/settings",
              { enabled: false },
              auth,
            )
          ).status,
        ).toBe(200);
        await expect(
          api.post("/admin/branding", { name: "Unauthorized" }, auth),
        ).rejects.toMatchObject({ response: { status: 403 } });
        await expect(api.get("/admin/customers", auth)).rejects.toMatchObject({
          response: { status: 403 },
        });
        await expect(api.get("/admin/orders", auth)).rejects.toMatchObject({
          response: { status: 403 },
        });
      });

      it("denies Support newsletter access and storefront-settings writes", async () => {
        const auth = await login("role_support");
        await expect(
          api.get("/admin/newsletter/subscribers", auth),
        ).rejects.toMatchObject({ response: { status: 403 } });
        await expect(
          api.post("/admin/storefront-settings", {}, auth),
        ).rejects.toMatchObject({ response: { status: 403 } });
      });

      it("lets Support load what Medusa's customer and order screens read", async () => {
        const auth = await login("role_support");
        for (const path of [
          "/admin/customer-groups",
          "/admin/notifications",
          "/admin/reservations",
          "/admin/stock-locations",
        ]) {
          expect((await api.get(path, auth)).status).toBe(200);
        }
        await expect(
          api.post("/admin/stock-locations", { name: "Not allowed" }, auth),
        ).rejects.toMatchObject({ response: { status: 403 } });
      });

      it("does not grant a logged-in roleless user protected settings access", async () => {
        const auth = await login(null);
        await expect(
          api.get("/admin/newsletter/settings", auth),
        ).rejects.toMatchObject({ response: { status: 403 } });
      });

      it("returns a bounded subscriber list without consent credentials", async () => {
        const service: NewsletterModuleService =
          getContainer().resolve(NEWSLETTER_MODULE);
        await service.createNewsletterSubscribers([
          {
            email: "subscriber@example.com",
            token: "private-unsubscribe-token",
            status: "pending",
          },
        ]);
        const auth = await login("role_marketing");
        const { data } = await api.get(
          "/admin/newsletter/subscribers?limit=1",
          auth,
        );
        expect(data.subscribers).toHaveLength(1);
        expect(data.subscribers[0]).not.toHaveProperty("token");
        expect(JSON.stringify(data)).not.toContain("private-unsubscribe-token");
        await expect(
          api.get("/admin/newsletter/subscribers?limit=101", auth),
        ).rejects.toMatchObject({ response: { status: 400 } });
      });

      it("lets Marketing save reviewed phrases and rejects stale writes", async () => {
        const auth = await login("role_marketing");
        const initial = (await api.get("/admin/search-vocabulary", auth)).data
          .vocabulary;
        const saved = (
          await api.post(
            "/admin/search-vocabulary",
            { terms: [" LINEN ", "linen"], revision: initial.revision },
            auth,
          )
        ).data.vocabulary;
        expect(saved.terms).toEqual(["linen"]);
        expect(saved.source).toBe("admin");
        expect(saved.revision).not.toBe(initial.revision);
        await expect(
          api.post(
            "/admin/search-vocabulary",
            { terms: ["dresses"], revision: initial.revision },
            auth,
          ),
        ).rejects.toMatchObject({ response: { status: 409 } });
        expect(
          (await api.get("/admin/search-vocabulary", auth)).data.vocabulary,
        ).toEqual(saved);
        await api.post(
          "/admin/search-vocabulary",
          { terms: [], revision: saved.revision },
          auth,
        );
        expect(
          (await api.get("/admin/search-vocabulary", auth)).data.vocabulary,
        ).toMatchObject({ terms: [], source: "admin" });
        const service = getContainer().resolve("searchInsights");
        await service.recordSearch("linen", 20);
        expect(await service.listSearchTermStats({})).toHaveLength(0);
      });

      it("keeps Support vocabulary access read-only and denies anonymous access", async () => {
        const auth = await login("role_support");
        expect((await api.get("/admin/search-vocabulary", auth)).status).toBe(
          200,
        );
        await expect(
          api.post(
            "/admin/search-vocabulary",
            { terms: [], revision: null },
            auth,
          ),
        ).rejects.toMatchObject({ response: { status: 403 } });
        await expect(api.get("/admin/search-vocabulary")).rejects.toMatchObject(
          { response: { status: 401 } },
        );
      });

      it("rejects invalid vocabulary input without saving it", async () => {
        const auth = await login("role_marketing");
        for (const terms of [
          ["customer@example.com"],
          Array(101).fill("linen"),
        ]) {
          await expect(
            api.post(
              "/admin/search-vocabulary",
              { terms, revision: null },
              auth,
            ),
          ).rejects.toMatchObject({ response: { status: 400 } });
        }
        expect(
          (await api.get("/admin/search-vocabulary", auth)).data.vocabulary
            .revision,
        ).toBeNull();
      });
    });
  },
});
