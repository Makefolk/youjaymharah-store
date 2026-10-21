import { model } from "@medusajs/framework/utils";

export const EmailDelivery = model
  .define("email_delivery", {
    id: model.id().primaryKey(),
    status: model
      .enum(["prepared", "attempted", "accepted", "needs_review"])
      .default("prepared"),
    payload_ciphertext: model.text().nullable(),
    first_attempt_at: model.dateTime().nullable(),
    accepted_at: model.dateTime().nullable(),
    provider_id: model.text().nullable(),
    attempts: model.number().default(0),
    // What happened after Resend accepted the email, from its webhooks. Only
    // the latest event is kept: support needs "did it arrive", not a log.
    outcome: model
      .enum([
        "delivered",
        "delayed",
        "bounced",
        "complained",
        "suppressed",
        "failed",
      ])
      .nullable(),
    outcome_at: model.dateTime().nullable(),
    /** The receiving server's reason, with email addresses blanked. */
    outcome_detail: model.text().nullable(),
    // A person's verdict on an uncertain send (Email review in the admin):
    // `sent` once Resend's records show it was accepted, `not_sent` once they
    // show it wasn't. A `not_sent` delivery stays blocked; a replacement is a
    // new email with its own identity.
    resolution: model.enum(["sent", "not_sent"]).nullable(),
    resolved_at: model.dateTime().nullable(),
    /** The admin user who decided. */
    resolved_by: model.text().nullable(),
    resolution_note: model.text().nullable(),
  })
  .indexes([{ on: ["provider_id"], where: "provider_id IS NOT NULL" }]);
