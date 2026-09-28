import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import { EmailTemplates } from "../modules/resend/emails";
import {
  captureNewsletterSignupStep,
  type CaptureNewsletterSignupInput,
} from "./steps/capture-newsletter-signup";
import { resolveNewsletterTokenStep } from "./steps/resolve-newsletter-token";
import { sendNewsletterEmailStep } from "./steps/send-newsletter-email";
import { syncNewsletterContactStep } from "./steps/sync-newsletter-contact";
import {
  updateNewsletterSettingsStep,
  type UpdateNewsletterSettingsInput,
} from "./steps/update-newsletter-settings";

export const subscribeToNewsletterWorkflow = createWorkflow(
  "subscribe-to-newsletter",
  function (input: CaptureNewsletterSignupInput) {
    const signup = captureNewsletterSignupStep(input);

    // Under double opt-in nothing reaches Resend until the address is
    // confirmed, so the audience only ever holds verified contacts.
    const emailInput = transform({ signup }, ({ signup }) => ({
      email: signup.email,
      token: signup.token,
      confirmation_token: signup.confirmation_token,
      template: signup.needs_confirmation
        ? EmailTemplates.NEWSLETTER_CONFIRM
        : EmailTemplates.NEWSLETTER_WELCOME,
      skip: signup.already_subscribed,
    }));

    sendNewsletterEmailStep(emailInput);

    const syncInput = transform({ signup }, ({ signup }) => ({
      subscriber_id: signup.id,
      email: signup.email,
      action: "subscribe" as const,
      skip: signup.needs_confirmation || signup.already_subscribed,
    }));

    syncNewsletterContactStep(syncInput);

    return new WorkflowResponse(signup);
  },
);

export const confirmNewsletterSubscriptionWorkflow = createWorkflow(
  "confirm-newsletter-subscription",
  function (input: { token: string; first_name: string }) {
    const subscriber = resolveNewsletterTokenStep({
      token: input.token,
      first_name: input.first_name,
      action: "confirm",
    });

    const syncInput = transform({ subscriber }, ({ subscriber }) => ({
      subscriber_id: subscriber.id,
      email: subscriber.email,
      action: "subscribe" as const,
    }));

    syncNewsletterContactStep(syncInput);

    const emailInput = transform(
      { subscriber, input },
      ({ subscriber, input }) => ({
        email: subscriber.email,
        token: subscriber.token,
        template: EmailTemplates.NEWSLETTER_WELCOME,
        skip: !subscriber.changed,
      }),
    );

    sendNewsletterEmailStep(emailInput);

    return new WorkflowResponse(subscriber);
  },
);

export const unsubscribeFromNewsletterWorkflow = createWorkflow(
  "unsubscribe-from-newsletter",
  function (input: { token: string }) {
    const subscriber = resolveNewsletterTokenStep({
      token: input.token,
      action: "unsubscribe",
    });

    const syncInput = transform({ subscriber }, ({ subscriber }) => ({
      subscriber_id: subscriber.id,
      email: subscriber.email,
      action: "unsubscribe" as const,
    }));

    syncNewsletterContactStep(syncInput);

    return new WorkflowResponse(subscriber);
  },
);

export const updateNewsletterSettingsWorkflow = createWorkflow(
  "update-newsletter-settings",
  function (input: UpdateNewsletterSettingsInput) {
    const settings = updateNewsletterSettingsStep(input);

    return new WorkflowResponse(settings);
  },
);
