import { MedusaError, Modules } from "@medusajs/framework/utils";
import type {
  ILockingModule,
  MedusaContainer,
} from "@medusajs/framework/types";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";
import { NEWSLETTER_MODULE } from "../../modules/newsletter";
import type NewsletterModuleService from "../../modules/newsletter/service";
import { canConfirm, newsletterLockKey } from "../../modules/newsletter/tokens";

export type ResolveNewsletterTokenInput = {
  token: string;
  action: "confirm" | "unsubscribe";
  first_name?: string;
};

export async function resolveNewsletterToken(
  input: ResolveNewsletterTokenInput,
  container: MedusaContainer,
) {
  const service: NewsletterModuleService = container.resolve(NEWSLETTER_MODULE);
  const locking: ILockingModule = container.resolve(Modules.LOCKING);
  const filter =
    input.action === "confirm"
      ? { id: input.token.split(".")[0] }
      : { token: input.token };
  const [found] = await service.listNewsletterSubscribers(filter);
  const invalid = () =>
    new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "That link is no longer valid. Please sign up again.",
    );
  if (!found) throw invalid();
  return await locking.execute(newsletterLockKey(found.email), async () => {
    const [subscriber] = await service.listNewsletterSubscribers(filter);
    if (
      !subscriber ||
      (input.action === "confirm" &&
        (subscriber.email_suppressed_at ||
          !canConfirm(subscriber, input.token)))
    )
      throw invalid();
    const status = input.action === "confirm" ? "subscribed" : "unsubscribed";
    const changed = subscriber.status !== status;
    if (changed) {
      await service.updateNewsletterSubscribers([
        {
          id: subscriber.id,
          status,
          sync_pending: true,
          ...(status === "subscribed"
            ? {
                confirmed_at: new Date(),
                unsubscribed_at: null,
                first_name: input.first_name?.trim() ?? subscriber.first_name,
              }
            : { unsubscribed_at: new Date() }),
        },
      ]);
    }
    return {
      id: subscriber.id,
      email: subscriber.email,
      token: subscriber.token,
      changed,
    };
  });
}

// Consent changes are not compensated when a later email or external sync fails.
export const resolveNewsletterTokenStep = createStep(
  "resolve-newsletter-token",
  async (input: ResolveNewsletterTokenInput, { container }) =>
    new StepResponse(await resolveNewsletterToken(input, container)),
);
