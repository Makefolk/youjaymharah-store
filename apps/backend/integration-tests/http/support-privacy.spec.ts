import { Readable } from "node:stream";
import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import type { IApiKeyModuleService } from "@medusajs/framework/types";
import { createUsersWorkflow } from "@medusajs/medusa/core-flows";
import { provisionRbacRoles } from "../../src/lib/rbac-roles";
import { requireIsolatedDatabase } from "../helpers/isolated-database";

requireIsolatedDatabase();
jest.setTimeout(120_000);

/** Stands in for the private support bucket. */
const bucket = new Map<string, Buffer>();
jest.mock("../../src/lib/support-files", () => {
  const actual = jest.requireActual("../../src/lib/support-files");
  return {
    ...actual,
    supportFileStore: () => ({
      upload: async (file: { filename: string; content: string }) => {
        const key = `support/${file.filename}-${bucket.size}`;
        bucket.set(key, Buffer.from(file.content, "base64"));
        return { key };
      },
      delete: async (files: { fileKey: string }[]) => {
        for (const file of files) bucket.delete(file.fileKey);
      },
      getDownloadStream: async ({ fileKey }: { fileKey: string }) =>
        Readable.from([bucket.get(fileKey)!]),
    }),
  };
});

const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70]);

type Sent = { to: string; subject: string; html: string };

medusaIntegrationTestRunner({
  inApp: true,
  dbName: "medusa-support-privacy-integration",
  testSuite: ({ api, getContainer, utils }) => {
    describe("private support photos and links", () => {
      let headers: Record<string, string>;
      const sent: Sent[] = [];

      beforeEach(async () => {
        sent.length = 0;
        bucket.clear();
        await provisionRbacRoles(getContainer());
        jest.spyOn(global, "fetch").mockImplementation(async (url, options) => {
          if (new URL(String(url)).origin !== "https://api.resend.com") {
            throw new Error(`Unexpected request to ${url}`);
          }
          const body = JSON.parse(String(options?.body));
          sent.push({
            to: String(body.to),
            subject: body.subject,
            html: String(body.html ?? ""),
          });
          return new Response(JSON.stringify({ id: `re_${sent.length}` }));
        });
        const key = await getContainer()
          .resolve<IApiKeyModuleService>(Modules.API_KEY)
          .createApiKeys({
            title: "Support privacy",
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

      async function staff() {
        const container = getContainer();
        const email = `support-${Date.now()}@example.com`;
        const password = "isolated-test-password-only";
        const { result: users } = await createUsersWorkflow(container).run({
          input: { users: [{ email, roles: ["role_support"] }] },
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

      const linkIn = (html: string) => {
        const match = html.match(
          /\/support\/(sreq_[A-Z0-9]+)\?access=([^"&<\s]+)/,
        );
        return match
          ? { id: match[1], access: decodeURIComponent(match[2]) }
          : null;
      };

      async function newRequest() {
        await api.post(
          "/store/contact",
          {
            name: "Ada",
            email: "ada@example.com",
            topic: "Delivery",
            message: "The box arrived crushed.",
          },
          // Its own address, clear of other suites' contact-form limit.
          { headers: { ...headers, "x-forwarded-for": "198.51.100.7" } },
        );
        await utils.waitWorkflowExecutions();
        const ack = sent.find((email) => email.to.includes("ada@example.com"))!;
        return linkIn(ack.html)!;
      }

      it("keeps photos private and serves them only to who may see them", async () => {
        const link = await newRequest();
        sent.length = 0;
        await api.post(
          `/store/support-requests/${link.id}/messages`,
          {
            access: link.access,
            body: "Here it is.",
            photos: [{ name: "box.jpg", data: JPEG.toString("base64") }],
          },
          { headers },
        );
        await utils.waitWorkflowExecutions();

        expect(bucket.size).toBe(1);
        const toStaff = sent.find((email) =>
          email.subject.includes("replied"),
        )!;
        expect(toStaff.html).toContain("1 photo attached");
        expect(toStaff.html).not.toContain("support/box");

        const { data } = await api.get(
          `/store/support-requests/${link.id}?access=${encodeURIComponent(link.access)}`,
          { headers },
        );
        const photoUrl: string = data.request.messages.at(-1).photos[0].url;
        expect(photoUrl).toMatch(
          new RegExp(`^/store/support-requests/${link.id}/photos/smsg_\\w+/0$`),
        );

        const withoutAccess = await api.get(photoUrl, {
          headers,
          validateStatus: () => true,
        });
        expect(withoutAccess.status).toBe(404);
        const photo = await api.get(
          `${photoUrl}?access=${encodeURIComponent(link.access)}`,
          { headers, responseType: "arraybuffer" },
        );
        expect(photo.headers["content-type"]).toBe("image/jpeg");
        expect(photo.headers["cache-control"]).toBe("private, max-age=300");
        expect(Buffer.from(photo.data)).toEqual(JPEG);

        const support = await staff();
        const { data: detail } = await api.get(
          `/admin/support-requests/${link.id}`,
          support,
        );
        const adminUrl: string =
          detail.request.messages.at(-1).attachments.files[0].url;
        const adminPhoto = await api.get(adminUrl, {
          ...support,
          responseType: "arraybuffer",
        });
        expect(Buffer.from(adminPhoto.data)).toEqual(JPEG);
      });

      it("lets staff cancel emailed links, and the customer get a fresh one", async () => {
        const link = await newRequest();
        const open = (access: string) =>
          api.get(
            `/store/support-requests/${link.id}?access=${encodeURIComponent(access)}`,
            { headers, validateStatus: () => true },
          );
        expect((await open(link.access)).status).toBe(200);

        const support = await staff();
        // A link issued in the same second as the cancel would survive it.
        await new Promise((resolve) => setTimeout(resolve, 1100));
        await api.post(
          `/admin/support-requests/${link.id}/revoke-links`,
          {},
          support,
        );
        expect((await open(link.access)).status).toBe(404);

        sent.length = 0;
        const asked = await api.post(
          `/store/support-requests/${link.id}/access-link`,
          {},
          { headers },
        );
        expect(asked.data).toEqual({ sent: true });
        await utils.waitWorkflowExecutions();
        expect(sent.map((email) => email.to)).toEqual(["ada@example.com"]);
        const fresh = linkIn(sent[0].html)!;
        expect((await open(fresh.access)).status).toBe(200);

        // Unknown requests answer the same and email nobody.
        sent.length = 0;
        const unknown = await api.post(
          "/store/support-requests/sreq_01UNKNOWN/access-link",
          {},
          { headers },
        );
        expect(unknown.data).toEqual({ sent: true });
        await utils.waitWorkflowExecutions();
        expect(sent).toEqual([]);
      });
    });
  },
});
