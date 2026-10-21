import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { normalizeEmailOutcome } from "../../../modules/email-delivery/outcome";
import {
  normalizeResendWebhook,
  verifyResendWebhookPayload,
} from "../../../modules/newsletter/resend-webhook";
import { processResendWebhookWorkflow } from "../../../workflows/process-resend-webhook";
import { recordEmailOutcomeWorkflow } from "../../../workflows/record-email-outcome";

export const POST = async (req: MedusaRequest, res: MedusaResponse) => {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) {
    res.status(503).json({ message: "Webhook receiver is not configured." });
    return;
  }
  let consent;
  let outcome;
  try {
    const payload = verifyResendWebhookPayload(
      req.rawBody,
      req.headers,
      secret,
    );
    consent = normalizeResendWebhook(payload, String(req.headers["svix-id"]));
    outcome = normalizeEmailOutcome(payload);
  } catch {
    res.status(400).json({ message: "Invalid webhook." });
    return;
  }
  if (consent)
    await processResendWebhookWorkflow(req.scope).run({ input: consent });
  if (outcome)
    await recordEmailOutcomeWorkflow(req.scope).run({ input: outcome });
  res.json({ received: true });
};
