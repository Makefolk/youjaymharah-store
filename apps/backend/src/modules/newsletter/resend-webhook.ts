import { createHash } from "node:crypto";
import { Resend } from "resend";
import { z } from "@medusajs/framework/zod";
import { MedusaError } from "@medusajs/framework/utils";

export const ResendConsentEvent = z.object({
  id: z.string().min(1).max(256),
  type: z.string().min(1).max(100),
  occurred_at: z.iso.datetime({ offset: true }),
  email: z.email().transform((email) => email.trim().toLowerCase()),
  action: z.enum([
    "unsubscribe",
    "hard_bounce",
    "complaint",
    "provider_suppression",
  ]),
  contact_id: z.string().min(1).max(256).optional(),
  audience_id: z.string().min(1).max(256).optional(),
});
export type ResendConsentEvent = z.infer<typeof ResendConsentEvent>;

const envelope = z.object({
  type: z.string(),
  created_at: z.iso.datetime({ offset: true }),
  data: z.record(z.string(), z.unknown()),
});
const verificationClient = new Resend("verification-only");

export function webhookReceiptId(id: string): string {
  return `rsev_${createHash("sha256").update(id).digest("hex")}`;
}

/**
 * The authenticated payload of a Resend webhook. Several features read the
 * same event (newsletter consent, email delivery outcomes), so verification
 * is separate from interpreting it.
 */
export function verifyResendWebhookPayload(
  rawBody: unknown,
  headers: Record<string, unknown>,
  secret: string,
): unknown {
  try {
    const id = headers["svix-id"];
    const timestamp = headers["svix-timestamp"];
    const signature = headers["svix-signature"];
    if (
      (typeof rawBody !== "string" && !Buffer.isBuffer(rawBody)) ||
      typeof id !== "string" ||
      typeof timestamp !== "string" ||
      typeof signature !== "string" ||
      !id ||
      id.length > 256
    )
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "Invalid webhook");
    return verificationClient.webhooks.verify({
      payload: rawBody.toString(),
      headers: { id, timestamp, signature },
      webhookSecret: secret,
    });
  } catch {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Invalid webhook signature.",
    );
  }
}

export function verifyResendWebhook(
  rawBody: unknown,
  headers: Record<string, unknown>,
  secret: string,
): ResendConsentEvent | null {
  return normalizeResendWebhook(
    verifyResendWebhookPayload(rawBody, headers, secret),
    String(headers["svix-id"]),
  );
}

export function normalizeResendWebhook(
  payload: unknown,
  id: string,
): ResendConsentEvent | null {
  const event = envelope.parse(payload);
  if (new Date(event.created_at).getTime() > Date.now() + 5 * 60_000)
    throw new MedusaError(
      MedusaError.Types.INVALID_DATA,
      "Invalid event timestamp.",
    );
  const data = event.data;
  let action: ResendConsentEvent["action"];
  let email: unknown;
  if (event.type === "contact.updated") {
    if (data.unsubscribed === false) return null;
    if (data.unsubscribed !== true)
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        "Missing contact unsubscribe state.",
      );
    action = "unsubscribe";
    email = data.email;
  } else if (event.type === "suppression.added") {
    action =
      data.origin === "bounce"
        ? "hard_bounce"
        : data.origin === "complaint"
          ? "complaint"
          : "provider_suppression";
    email = data.email;
  } else if (
    ["email.bounced", "email.complained", "email.suppressed"].includes(
      event.type,
    )
  ) {
    if (event.type === "email.bounced") {
      const bounce = z.object({ type: z.string() }).parse(data.bounce);
      if (bounce.type !== "Permanent") return null;
      action = "hard_bounce";
    } else {
      action =
        event.type === "email.complained"
          ? "complaint"
          : "provider_suppression";
    }
    // Resend emits one delivery outcome per recipient. Ambiguous older payloads
    // must not accidentally suppress every recipient of a multi-address email.
    email = z.array(z.email()).length(1).parse(data.to)[0];
  } else return null;

  return ResendConsentEvent.parse({
    id,
    type: event.type,
    occurred_at: event.created_at,
    email,
    action,
    ...(event.type === "contact.updated"
      ? { contact_id: data.id, audience_id: data.audience_id }
      : {}),
  });
}
