import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils";
import type {
  ILockingModule,
  MedusaContainer,
} from "@medusajs/framework/types";
import { NEWSLETTER_MODULE } from "../../modules/newsletter";
import { ResendAudienceClient } from "../../modules/newsletter/resend-audience";
import type NewsletterModuleService from "../../modules/newsletter/service";
import { newsletterLockKey } from "../../modules/newsletter/tokens";

export type SyncNewsletterContactInput = {
  subscriber_id: string;
  skip?: boolean;
};

export async function syncNewsletterContact(
  input: SyncNewsletterContactInput,
  container: MedusaContainer,
) {
  if (input.skip) return;
  const service: NewsletterModuleService = container.resolve(NEWSLETTER_MODULE);
  const locking: ILockingModule = container.resolve(Modules.LOCKING);
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const [found] = await service.listNewsletterSubscribers({
    id: input.subscriber_id,
  });
  if (!found) return;
  await locking.execute(newsletterLockKey(found.email), async () => {
    const [subscriber] = await service.listNewsletterSubscribers({
      id: found.id,
    });
    if (!subscriber?.sync_pending || subscriber.status === "pending") return;
    if (
      subscriber.email_suppressed_at &&
      subscriber.status !== "unsubscribed"
    ) {
      await service.updateNewsletterSubscribers([
        { id: subscriber.id, sync_pending: false },
      ]);
      return;
    }
    await service.updateNewsletterSubscribers([
      { id: subscriber.id, sync_attempted_at: new Date() },
    ]);
    const settings = await service.retrieveSettings();
    if (!settings.audience_id) return;
    try {
      const client = new ResendAudienceClient();
      let contactId = subscriber.resend_contact_id;
      if (subscriber.status === "unsubscribed") {
        await client.unsubscribeContact({
          audienceId: settings.audience_id,
          email: subscriber.email,
        });
      } else {
        contactId =
          (await client.addContact({
            audienceId: settings.audience_id,
            email: subscriber.email,
            firstName: subscriber.first_name ?? undefined,
          })) ?? null;
      }
      await service.updateNewsletterSubscribers([
        {
          id: subscriber.id,
          resend_contact_id: contactId,
          sync_pending: false,
        },
      ]);
    } catch (error) {
      // The scheduled reconciliation reads this durable flag after an outage or restart.
      logger.error(
        error instanceof MedusaError &&
          error.type === MedusaError.Types.NOT_ALLOWED
          ? `newsletter: subscriber ${subscriber.id} is unsubscribed in Resend; renewed consent requires review before resubscribing.`
          : `newsletter: contact sync failed for subscriber ${subscriber.id}; queued for retry.`,
      );
    }
  });
}

export const syncNewsletterContactStep = createStep(
  { name: "sync-newsletter-contact", maxRetries: 5, retryInterval: 15 },
  async (input: SyncNewsletterContactInput, { container }) => {
    await syncNewsletterContact(input, container);
    return new StepResponse(null);
  },
);
