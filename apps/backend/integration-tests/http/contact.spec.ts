import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import type { IApiKeyModuleService } from "@medusajs/framework/types";
import { createUsersWorkflow } from "@medusajs/medusa/core-flows";
import { provisionRbacRoles } from "../../src/lib/rbac-roles";
import { requireIsolatedDatabase } from "../helpers/isolated-database";

requireIsolatedDatabase();
jest.setTimeout(120_000);

type Sent = { to: string; subject: string; reply_to?: string; html: string };

medusaIntegrationTestRunner({
  inApp: true,
  dbName: "medusa-contact-integration",
  testSuite: ({ api, getContainer, utils }) => {
    describe("contact page", () => {
      let headers: Record<string, string>;
      const sent: Sent[] = [];

      beforeEach(async () => {
        sent.length = 0;
        await provisionRbacRoles(getContainer());
        jest.spyOn(global, "fetch").mockImplementation(async (url, options) => {
          if (new URL(String(url)).origin !== "https://api.resend.com")
            throw new Error("Unexpected external request in contact test");
          const body = JSON.parse(String(options?.body));
          sent.push({
            to: String(body.to),
            subject: body.subject,
            reply_to: body.reply_to ? String(body.reply_to) : undefined,
            html: String(body.html ?? ""),
          });
          return new Response(JSON.stringify({ id: `re_${sent.length}` }));
        });
        const key = await getContainer()
          .resolve<IApiKeyModuleService>(Modules.API_KEY)
          .createApiKeys({
            title: "Contact test",
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

      it("emails support with the customer as reply-to, and acknowledges", async () => {
        const manager = await login("role_store_manager");
        await api.post(
          "/admin/support-info",
          {
            response_time: "within one working day",
            phone: "+234 801 234 5678",
          },
          manager,
        );

        const { data } = await api.post(
          "/store/contact",
          {
            name: "Ada",
            email: "Ada@Example.com",
            topic: "An order",
            order_number: "#1042",
            message: "My order hasn't arrived yet.",
          },
          { headers },
        );
        expect(data).toEqual({ sent: true });
        await utils.waitWorkflowExecutions();

        const toSupport = sent.find((email) =>
          email.subject.startsWith("Contact form"),
        );
        expect(toSupport).toMatchObject({ reply_to: "ada@example.com" });
        expect(toSupport!.html).toContain("#1042");
        expect(toSupport!.html).toContain("no order with this number");

        const toCustomer = sent.find((email) =>
          email.to.includes("ada@example.com"),
        );
        expect(toCustomer!.subject).toContain("got your message");
        expect(toCustomer!.html).toContain("within one working day");

        const settings = await api.get("/store/storefront-settings", {
          headers,
        });
        expect(settings.data.settings.support).toMatchObject({
          response_time: "within one working day",
          phone: "+2348012345678",
          hours: null,
        });
      });

      it("drops bot submissions quietly and refuses bad input", async () => {
        const { data } = await api.post(
          "/store/contact",
          {
            name: "Bot",
            email: "bot@example.com",
            message: "Buy cheap things now!!!",
            website: "https://spam.example",
          },
          { headers },
        );
        expect(data).toEqual({ sent: true });
        await utils.waitWorkflowExecutions();
        expect(sent).toEqual([]);

        await expect(
          api.post(
            "/store/contact",
            { name: "Ada", email: "not-an-email", message: "Hello there!" },
            { headers },
          ),
        ).rejects.toMatchObject({ response: { status: 400 } });
      });

      it("lets Support read the contact details but not change them", async () => {
        const support = await login("role_support");
        const { data } = await api.get("/admin/support-info", support);
        expect(data.support_info).toHaveProperty("hours");
        await expect(
          api.post("/admin/support-info", { hours: "Always" }, support),
        ).rejects.toMatchObject({ response: { status: 403 } });

        const manager = await login("role_store_manager");
        await expect(
          api.post("/admin/support-info", { phone: "0801 234" }, manager),
        ).rejects.toMatchObject({ response: { status: 400 } });
      });
    });
  },
});
