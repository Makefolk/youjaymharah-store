import { model } from "@medusajs/framework/utils";

/**
 * A captured newsletter signup.
 *
 * Medusa owns capture and consent; Resend owns sending. `resend_contact_id`
 * is the link between the two, set once the address is confirmed and pushed
 * into the configured audience.
 */
export const NewsletterSubscriber = model
  .define("newsletter_subscriber", {
    id: model.id({ prefix: "nlsub" }).primaryKey(),
    email: model.text().searchable(),
    first_name: model.text().nullable(),
    // pending -> confirmed via the emailed link -> subscribed
    // unsubscribed is terminal until the address signs up again
    status: model.enum(["pending", "subscribed", "unsubscribed"]),
    /** Where the signup came from, e.g. "storefront_footer", "checkout". */
    source: model.text().nullable(),
    /** Snapshot of the consent wording shown at signup, kept as evidence. */
    consent_text: model.text().nullable(),
    consent_at: model.dateTime().nullable(),
    confirmed_at: model.dateTime().nullable(),
    unsubscribed_at: model.dateTime().nullable(),
    /** Unsubscribe credential; also keys a separate, expiring confirmation signature. */
    token: model.text(),
    resend_contact_id: model.text().nullable(),
    sync_pending: model.boolean().default(true),
    sync_attempted_at: model.dateTime().nullable(),
    provider_consent_at: model.dateTime().nullable(),
    email_suppressed_at: model.dateTime().nullable(),
    email_suppression_reason: model
      .enum(["hard_bounce", "complaint", "provider_suppression"])
      .nullable(),
  })
  .indexes([
    { on: ["email"], unique: true, where: "deleted_at IS NULL" },
    { on: ["token"], unique: true, where: "deleted_at IS NULL" },
  ]);
