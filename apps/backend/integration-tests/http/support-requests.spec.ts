import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import type {
  IApiKeyModuleService,
  IFileModuleService,
} from "@medusajs/framework/types";
import {
  completeCartWorkflow,
  createUsersWorkflow,
} from "@medusajs/medusa/core-flows";
import { provisionRbacRoles } from "../../src/lib/rbac-roles";
import { requireIsolatedDatabase } from "../helpers/isolated-database";
import { createOrderAccessKey } from "../../src/lib/order-access";
import { physicalCheckoutFixture } from "../helpers/physical-checkout";

requireIsolatedDatabase();
jest.setTimeout(120_000);

type Sent = { to: string; subject: string; html: string; reply_to?: string };

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70]).toString(
  "base64",
);

medusaIntegrationTestRunner({
  inApp: true,
  dbName: "medusa-support-requests-integration",
  testSuite: ({ api, getContainer, utils }) => {
    describe("support requests", () => {
      let headers: Record<string, string>;
      const sent: Sent[] = [];

      beforeEach(async () => {
        sent.length = 0;
        await provisionRbacRoles(getContainer());
        jest.spyOn(global, "fetch").mockImplementation(async (url, options) => {
          const target = new URL(String(url));
          if (target.origin === "https://api.resend.com") {
            const body = JSON.parse(String(options?.body));
            sent.push({
              to: String(body.to),
              subject: body.subject,
              html: String(body.html ?? ""),
              reply_to: body.reply_to ? String(body.reply_to) : undefined,
            });
            return new Response(JSON.stringify({ id: `re_${sent.length}` }));
          }
          if (target.origin !== "https://api.paystack.co")
            throw new Error(`Unexpected request to ${target.origin}`);
          const body = options?.body ? JSON.parse(String(options.body)) : {};
          const reference =
            body.reference ??
            decodeURIComponent(target.pathname.split("/").at(-1)!);
          const data = target.pathname.startsWith("/transaction/verify/")
            ? { reference, status: "success", currency: "NGN", amount: 129000 }
            : { reference, authorization_url: "https://example.com/pay" };
          return new Response(JSON.stringify({ status: true, data }));
        });
        // Photos go to R2 in production; stored nowhere here.
        const files = getContainer().resolve<IFileModuleService>(Modules.FILE);
        jest.spyOn(files, "createFiles").mockImplementation((async (
          input: { filename: string }[],
        ) =>
          input.map((file, index) => ({
            id: `file_${index}`,
            url: `https://files.example/${file.filename}`,
          }))) as never);
        const key = await getContainer()
          .resolve<IApiKeyModuleService>(Modules.API_KEY)
          .createApiKeys({
            title: "Support test",
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

      const linkIn = (email: Sent) => {
        const match = email.html.match(
          /\/support\/(sreq_[A-Z0-9]+)\?access=([^"&<\s]+)/,
        );
        return match
          ? { id: match[1], access: decodeURIComponent(match[2]) }
          : null;
      };

      it("runs a contact request from first message to reply", async () => {
        const { data } = await api.post(
          "/store/contact",
          {
            name: "Ada",
            email: "ada@example.com",
            topic: "Delivery",
            message: "When will my order arrive in Abuja?",
          },
          { headers },
        );
        expect(data).toEqual({
          sent: true,
          reference: expect.stringMatching(/^SR-/),
        });
        // No link for the sender: it is only in the email.
        expect(JSON.stringify(data)).not.toContain("access");
        await utils.waitWorkflowExecutions();

        const toStaff = sent.find(
          (email) =>
            email.subject.includes(data.reference) &&
            !email.to.includes("ada@example.com"),
        );
        expect(toStaff).toMatchObject({ reply_to: "ada@example.com" });
        const ack = sent.find((email) => email.to.includes("ada@example.com"))!;
        const link = linkIn(ack)!;
        expect(link).not.toBeNull();

        await expect(
          api.get(`/store/support-requests/${link.id}`, { headers }),
        ).rejects.toMatchObject({ response: { status: 404 } });
        const viewed = await api.get(
          `/store/support-requests/${link.id}?access=${encodeURIComponent(link.access)}`,
          { headers },
        );
        expect(viewed.data.request).toMatchObject({
          reference: data.reference,
          kind: "delivery",
          status: "open",
          messages: [expect.objectContaining({ author: "customer" })],
        });

        const support = await login("role_support");
        sent.length = 0;
        await api.post(
          `/admin/support-requests/${link.id}/messages`,
          { body: "Check the courier: not delivered yet.", internal: true },
          support,
        );
        await api.post(
          `/admin/support-requests/${link.id}/messages`,
          { body: "It arrives Thursday." },
          support,
        );
        await utils.waitWorkflowExecutions();
        // The note emails nobody; the reply emails the customer.
        expect(sent.map((email) => email.to)).toEqual(["ada@example.com"]);
        expect(sent[0].html).toContain("It arrives Thursday.");

        const thread = await api.get(
          `/store/support-requests/${link.id}?access=${encodeURIComponent(link.access)}`,
          { headers },
        );
        expect(thread.data.request.status).toBe("awaiting_customer");
        expect(
          thread.data.request.messages.map((m: { body: string }) => m.body),
        ).toEqual([
          "When will my order arrive in Abuja?",
          "It arrives Thursday.",
        ]);

        sent.length = 0;
        await api.post(
          `/store/support-requests/${link.id}/messages`,
          {
            access: link.access,
            body: "Thank you!",
            photos: [{ name: "box.jpg", data: JPEG }],
          },
          { headers },
        );
        await utils.waitWorkflowExecutions();
        expect(sent).toEqual([
          expect.objectContaining({
            subject: expect.stringContaining("replied"),
          }),
        ]);

        const { data: inbox } = await api.get(
          "/admin/support-requests?status=open",
          support,
        );
        expect(inbox.requests).toEqual([
          expect.objectContaining({ id: link.id, status: "open" }),
        ]);
        await api.post(
          `/admin/support-requests/${link.id}`,
          { status: "resolved", priority: "high", assigned_to: "user_x" },
          support,
        );
        const { data: detail } = await api.get(
          `/admin/support-requests/${link.id}`,
          support,
        );
        expect(detail.request).toMatchObject({
          status: "resolved",
          priority: "high",
          assigned_to: "user_x",
        });
        expect(detail.request.messages).toHaveLength(4);
        expect(detail.request.messages[3].attachments.files[0].url).toContain(
          "box.jpg",
        );
      });

      it("routes order help to the order's own email", async () => {
        const container = getContainer();
        const fixture = await physicalCheckoutFixture(container);
        const cart = await fixture.cart();
        const { result: order } = await completeCartWorkflow(container).run({
          input: { id: cart.id },
        });
        sent.length = 0;
        const withKey = {
          headers: {
            ...headers,
            "x-order-access": createOrderAccessKey(order.id),
          },
        };

        // The order ID alone opens nothing.
        await expect(
          api.post(
            `/store/orders/${order.id}/help`,
            { kind: "order", message: "Where is it?" },
            { headers },
          ),
        ).rejects.toMatchObject({ response: { status: 404 } });

        await expect(
          api.post(
            `/store/orders/${order.id}/help`,
            {
              kind: "damaged",
              message: "The strap came off on the first day.",
              photos: [
                {
                  name: "x.html",
                  data: Buffer.from("<html>").toString("base64"),
                },
              ],
            },
            withKey,
          ),
        ).rejects.toMatchObject({ response: { status: 400 } });

        const { data } = await api.post(
          `/store/orders/${order.id}/help`,
          {
            kind: "damaged",
            message: "The strap came off on the first day.",
            photos: [{ name: "strap.jpg", data: JPEG }],
          },
          withKey,
        );
        expect(data).toEqual({
          reference: expect.stringMatching(/^SR-/),
          sent_to: "p•••@example.com",
        });
        await utils.waitWorkflowExecutions();
        const ack = sent.find(
          (email) =>
            email.to.includes("physical-checkout@example.com") &&
            email.subject.includes(data.reference),
        );
        expect(ack).toBeDefined();
        expect(linkIn(ack!)).not.toBeNull();
      });

      it("keeps Marketing out of the inbox", async () => {
        const marketing = await login("role_marketing");
        await expect(
          api.get("/admin/support-requests", marketing),
        ).rejects.toMatchObject({ response: { status: 403 } });
      });
    });
  },
});
