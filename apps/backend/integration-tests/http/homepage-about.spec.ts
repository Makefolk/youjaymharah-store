import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import type { IApiKeyModuleService } from "@medusajs/framework/types";
import { createUsersWorkflow } from "@medusajs/medusa/core-flows";
import { provisionRbacRoles } from "../../src/lib/rbac-roles";
import { DEFAULT_HOMEPAGE_ABOUT } from "../../src/modules/storefront-settings/homepage-about";
import { requireIsolatedDatabase } from "../helpers/isolated-database";

requireIsolatedDatabase();
jest.setTimeout(120_000);

medusaIntegrationTestRunner({
  inApp: true,
  dbName: "medusa-homepage-about-integration",
  testSuite: ({ api, getContainer }) => {
    describe("Homepage About content", () => {
      let headers: Record<string, string>;

      beforeEach(async () => {
        await provisionRbacRoles(getContainer());
        const key = await getContainer()
          .resolve<IApiKeyModuleService>(Modules.API_KEY)
          .createApiKeys({
            title: "Homepage About test",
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

      it("seeds usable content without requiring an image or a published About page", async () => {
        const { data } = await api.get("/store/storefront-settings", {
          headers,
        });
        expect(data.settings.homepage.about).toEqual(DEFAULT_HOMEPAGE_ABOUT);
        expect(data.settings.pages.about).toBe(false);
      });

      it.each(["role_marketing", "role_store_manager"])(
        "lets %s publish, replace and hide the section without altering other settings",
        async (role) => {
          const staff = await login(role);
          const about = {
            enabled: true,
            title: "A wardrobe of your own",
            description: "Our introduction.\n\nAnother paragraph.",
            image_url: "https://example.com/about.jpg",
            image_alt: "Clothes hanging on a rail",
            cta_label: "Shop now",
            cta_url: "/products",
          };
          await api.post(
            "/admin/storefront-settings",
            { homepage_about: about, new_badge_days: 14 },
            staff,
          );
          const { data } = await api.get("/store/storefront-settings", {
            headers,
          });
          expect(data.settings.homepage.about).toEqual({
            ...about,
            eyebrow: null,
          });
          expect(data.settings.products.new_badge_days).toBe(14);

          await api.post(
            "/admin/storefront-settings",
            { seo_title: "A new store title" },
            staff,
          );
          const unchanged = await api.get("/admin/storefront-settings", staff);
          expect(unchanged.data.settings.homepage_about).toEqual({
            ...about,
            eyebrow: null,
          });

          await api.post(
            "/admin/storefront-settings",
            {
              homepage_about: {
                enabled: true,
                title: about.title,
                description: about.description,
              },
            },
            staff,
          );
          const cleared = await api.get("/store/storefront-settings", {
            headers,
          });
          expect(cleared.data.settings.homepage.about).toMatchObject({
            enabled: true,
            image_url: null,
            image_alt: null,
            cta_label: null,
            cta_url: null,
          });

          await api.post(
            "/admin/storefront-settings",
            { homepage_about: { enabled: false } },
            staff,
          );
          const hidden = await api.get("/store/storefront-settings", {
            headers,
          });
          expect(hidden.data.settings.homepage.about).toMatchObject({
            enabled: false,
            title: null,
            description: null,
          });
          expect(hidden.data.settings.products.new_badge_days).toBe(14);
          expect(hidden.data.settings.seo.title).toBe("A new store title");
        },
      );

      it("keeps Support read-only and refuses unauthenticated edits", async () => {
        const support = await login("role_support");
        const { data } = await api.get("/admin/storefront-settings", support);
        expect(data.settings.homepage_about).toEqual(DEFAULT_HOMEPAGE_ABOUT);
        const body = { homepage_about: { enabled: false } };
        await expect(
          api.post("/admin/storefront-settings", body, support),
        ).rejects.toMatchObject({ response: { status: 403 } });
        await expect(
          api.post("/admin/storefront-settings", body),
        ).rejects.toMatchObject({ response: { status: 401 } });
        const unchanged = await api.get("/store/storefront-settings", {
          headers,
        });
        expect(unchanged.data.settings.homepage.about.enabled).toBe(true);
      });

      it("rejects unsafe links, incomplete content and images without descriptions before saving", async () => {
        const staff = await login("role_marketing");
        for (const about of [
          { enabled: true },
          { ...DEFAULT_HOMEPAGE_ABOUT, cta_url: "javascript:alert(1)" },
          { ...DEFAULT_HOMEPAGE_ABOUT, cta_url: "/\\example.com" },
          { ...DEFAULT_HOMEPAGE_ABOUT, cta_url: "//example.com" },
          { ...DEFAULT_HOMEPAGE_ABOUT, cta_label: null },
          {
            ...DEFAULT_HOMEPAGE_ABOUT,
            image_url: "https://example.com/photo.jpg",
          },
          {
            ...DEFAULT_HOMEPAGE_ABOUT,
            image_url: "data:image/svg+xml,invalid",
            image_alt: "A photo",
          },
          {
            ...DEFAULT_HOMEPAGE_ABOUT,
            image_url: "https://user:password@example.com/photo.jpg",
            image_alt: "A photo",
          },
        ]) {
          await expect(
            api.post(
              "/admin/storefront-settings",
              { homepage_about: about },
              staff,
            ),
          ).rejects.toMatchObject({ response: { status: 400 } });
        }
        const { data } = await api.get("/store/storefront-settings", {
          headers,
        });
        expect(data.settings.homepage.about).toEqual(DEFAULT_HOMEPAGE_ABOUT);
      });
    });
  },
});
