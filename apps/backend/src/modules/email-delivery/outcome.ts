import { z } from "@medusajs/framework/zod";

import { redactEmailAddresses } from "../resend/send-failure";

export const EMAIL_OUTCOMES = [
  "delivered",
  "delayed",
  "bounced",
  "complained",
  "suppressed",
  "failed",
] as const;

export type EmailOutcomeName = (typeof EMAIL_OUTCOMES)[number];

export const EmailOutcomeEvent = z.object({
  provider_id: z.string().min(1).max(256),
  outcome: z.enum(EMAIL_OUTCOMES),
  occurred_at: z.iso.datetime({ offset: true }),
  detail: z.string().max(500).nullable(),
});
export type EmailOutcomeEvent = z.infer<typeof EmailOutcomeEvent>;

const outcomes: Record<string, EmailOutcomeName> = {
  "email.delivered": "delivered",
  "email.delivery_delayed": "delayed",
  "email.bounced": "bounced",
  "email.complained": "complained",
  "email.suppressed": "suppressed",
  "email.failed": "failed",
};

const envelope = z.object({
  type: z.string(),
  created_at: z.iso.datetime({ offset: true }),
  data: z.record(z.string(), z.unknown()),
});

const reason = z
  .object({
    type: z.string().optional(),
    subType: z.string().optional(),
    message: z.string().optional(),
    reason: z.string().optional(),
  })
  .partial();

/**
 * The reason a receiving server or Resend gave, for staff to read. Resend
 * nests it under a key named after the event (`bounce`, `failed`,
 * `suppressed`); none of them are guaranteed, so a missing one is not an
 * error.
 */
function describe(data: Record<string, unknown>): string | null {
  for (const key of ["bounce", "failed", "suppressed"]) {
    const parsed = reason.safeParse(data[key]);
    if (!parsed.success) continue;
    const { type, subType, message, reason: why } = parsed.data;
    const kind = [type, subType].filter(Boolean).join(" / ");
    const text = [kind, message ?? why].filter(Boolean).join(": ");
    if (text) return redactEmailAddresses(text).slice(0, 500);
  }
  return null;
}

/**
 * The delivery outcome a verified Resend webhook reports for one sent email,
 * or null for events that say nothing about delivery (sent, opened, contact
 * changes...).
 */
export function normalizeEmailOutcome(
  payload: unknown,
): EmailOutcomeEvent | null {
  const parsed = envelope.safeParse(payload);
  if (!parsed.success) return null;
  const outcome = outcomes[parsed.data.type];
  const providerId = parsed.data.data.email_id;
  if (!outcome || typeof providerId !== "string" || !providerId) return null;

  return EmailOutcomeEvent.parse({
    provider_id: providerId,
    outcome,
    occurred_at: parsed.data.created_at,
    detail: describe(parsed.data.data),
  });
}
