import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import type { IApiKeyModuleService } from "@medusajs/framework/types";
import { NEWSLETTER_MODULE } from "../../src/modules/newsletter";
import type NewsletterModuleService from "../../src/modules/newsletter/service";
import { confirmationToken } from "../../src/modules/newsletter/tokens";
import { requireIsolatedDatabase } from "../helpers/isolated-database";

requireIsolatedDatabase();
jest.setTimeout(120_000);

medusaIntegrationTestRunner({
  inApp: true,
  dbName: "medusa-newsletter-integration",
  testSuite: ({ api, getContainer }) => {
    describe("newsletter registration and confirmation", () => {
      const originalFetch = global.fetch;
      let service: NewsletterModuleService;
      let headers: Record<string, string>;
      let provider: jest.Mock;

      beforeEach(async () => {
        service = getContainer().resolve(NEWSLETTER_MODULE);
        const keys: IApiKeyModuleService = getContainer().resolve(
          Modules.API_KEY,
        );
        const key = await keys.createApiKeys({
          title: "Newsletter test",
          type: "publishable",
          created_by: "test",
        });
        headers = { "x-publishable-api-key": key.token };
        const settings = await service.retrieveSettings();
        await service.updateNewsletterSettings({
          id: settings.id,
          enabled: true,
          double_opt_in: true,
          audience_id: "segment",
        });
        provider = jest.fn(async (url: string) => {
          if (url.includes("/contacts/") && !url.includes("/segments")) {
            return new Response(
              JSON.stringify({ name: "not_found", message: "Missing" }),
              { status: 404 },
            );
          }
          return new Response(JSON.stringify({ id: "provider_id" }));
        });
        global.fetch = provider;
      });
      afterEach(() => {
        global.fetch = originalFetch;
      });

      async function signup() {
        expect(
          (
            await api.post(
              "/store/newsletter/subscribe",
              {
                email: "buyer@example.com",
                source: "footer",
              },
              { headers },
            )
          ).status,
        ).toBe(200);
        const [subscriber] = await service.listNewsletterSubscribers({
          email: "buyer@example.com",
        });
        return subscriber;
      }

      it("captures the name on confirmation, persists it, and sends it to Resend", async () => {
        const subscriber = await signup();
        expect(subscriber).toMatchObject({
          status: "pending",
          first_name: null,
        });
        expect(
          provider.mock.calls.some(([url]) => url.includes("/contacts")),
        ).toBe(false);
        const token = confirmationToken(subscriber);
        const confirmationEmail = provider.mock.calls.find(([url]) =>
          url.endsWith("/emails"),
        );
        expect(confirmationEmail).toBeDefined();
        expect(JSON.parse(confirmationEmail![1].body).html).toContain(
          `/newsletter/confirm?token=${token}`,
        );
        expect(
          (
            await api.post(
              "/store/newsletter/confirm",
              {
                token,
                first_name: "  Ọlá  ",
              },
              { headers },
            )
          ).data,
        ).toMatchObject({ success: true, status: "subscribed" });
        expect(
          await service.retrieveNewsletterSubscriber(subscriber.id),
        ).toMatchObject({
          first_name: "Ọlá",
          status: "subscribed",
          sync_pending: false,
        });
        const contact = provider.mock.calls.find(
          ([url, options]) =>
            url.endsWith("/contacts") && options.method === "POST",
        );
        expect(contact).toBeDefined();
        expect(JSON.parse(contact![1].body)).toMatchObject({
          email: subscriber.email,
          first_name: "Ọlá",
        });

        const emails = provider.mock.calls.filter(([url]) =>
          url.endsWith("/emails"),
        );
        expect(emails).toHaveLength(2);
        expect(JSON.parse(emails[1][1].body).html).toContain(
          `/newsletter/unsubscribe?token=${subscriber.token}`,
        );

        await api.post(
          "/store/newsletter/confirm",
          { token, first_name: "Replay" },
          { headers },
        );
        expect(
          (await service.retrieveNewsletterSubscriber(subscriber.id))
            .first_name,
        ).toBe("Ọlá");
        await api.post(
          "/store/newsletter/unsubscribe",
          { token: subscriber.token },
          { headers },
        );
        await expect(
          api.post(
            "/store/newsletter/confirm",
            { token, first_name: "Replay" },
            { headers },
          ),
        ).rejects.toMatchObject({ response: { status: 404 } });
      });

      it.each([undefined, "", "   ", "a".repeat(101)])(
        "rejects an invalid first name without confirming",
        async (first_name) => {
          const subscriber = await signup();
          await expect(
            api.post(
              "/store/newsletter/confirm",
              {
                token: confirmationToken(subscriber),
                first_name,
              },
              { headers },
            ),
          ).rejects.toMatchObject({ response: { status: 400 } });
          expect(
            await service.retrieveNewsletterSubscriber(subscriber.id),
          ).toMatchObject({ first_name: null, status: "pending" });
        },
      );
    });
  },
});
