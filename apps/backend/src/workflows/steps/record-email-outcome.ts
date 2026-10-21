import type { ILockingModule } from "@medusajs/framework/types";
import { MedusaError, Modules } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { EMAIL_DELIVERY_MODULE } from "../../modules/email-delivery";
import { EmailOutcomeEvent } from "../../modules/email-delivery/outcome";
import type EmailDeliveryModuleService from "../../modules/email-delivery/service";

const MAX_RETRIES = 3;

export const recordEmailOutcomeStep = createStep(
  { name: "record-email-outcome", maxRetries: MAX_RETRIES, retryInterval: 30 },
  async (input: EmailOutcomeEvent, { container, attempt }) => {
    const event = EmailOutcomeEvent.parse(input);
    const service: EmailDeliveryModuleService = container.resolve(
      EMAIL_DELIVERY_MODULE,
    );
    const locking: ILockingModule = container.resolve(Modules.LOCKING);

    const [found] = await service.listEmailDeliveries(
      { provider_id: event.provider_id },
      { select: ["id"] },
    );
    if (!found) {
      // A fast "delivered" can arrive before the send has stored Resend's
      // receipt, so wait a little. Emails sent from Resend's own dashboard
      // never match; after the retries they are ignored.
      if (attempt <= MAX_RETRIES)
        throw new MedusaError(
          MedusaError.Types.NOT_FOUND,
          "No email delivery has this provider receipt yet.",
        );
      return new StepResponse({ recorded: false });
    }

    // Same lock as the send, so the two never write the row at once.
    const recorded = await locking.execute(
      `email-delivery:${found.id}`,
      async () => {
        const [delivery] = await service.listEmailDeliveries({ id: found.id });
        const occurredAt = new Date(event.occurred_at);
        // Webhooks can arrive out of order; the latest event wins.
        if (
          delivery.outcome_at &&
          new Date(delivery.outcome_at).getTime() >= occurredAt.getTime()
        )
          return false;
        await service.updateEmailDeliveries({
          id: delivery.id,
          outcome: event.outcome,
          outcome_at: occurredAt,
          outcome_detail: event.detail,
        });
        return true;
      },
      { timeout: 60 },
    );

    return new StepResponse({ recorded });
  },
);
