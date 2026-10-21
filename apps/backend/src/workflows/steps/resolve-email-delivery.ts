import type { ILockingModule } from "@medusajs/framework/types";
import { MedusaError, Modules } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { EMAIL_DELIVERY_MODULE } from "../../modules/email-delivery";
import type EmailDeliveryModuleService from "../../modules/email-delivery/service";
import { SAFE_RETRY_WINDOW_MS } from "../../modules/resend/delivery";

export type ResolveEmailDeliveryInput = {
  id: string;
  /**
   * sent: Resend's records show it accepted the email; `provider_id` is the
   * email's ID there. not_sent: they show it didn't; the delivery stays
   * blocked so the old email can never go out late.
   */
  resolution: "sent" | "not_sent";
  provider_id?: string | null;
  note?: string | null;
  user_id: string;
};

type Snapshot = {
  id: string;
  status: "prepared" | "attempted" | "accepted" | "needs_review";
  provider_id: string | null;
  accepted_at: Date | null;
  payload_ciphertext: string | null;
};

/**
 * Records a person's verdict on an uncertain send, as the review procedure in
 * docs/email-reliability.md describes. Holds the same lock as sending, so a
 * verdict can't race a send in progress.
 */
export const resolveEmailDeliveryStep = createStep(
  "resolve-email-delivery",
  async (input: ResolveEmailDeliveryInput, { container }) => {
    const service: EmailDeliveryModuleService = container.resolve(
      EMAIL_DELIVERY_MODULE,
    );
    const locking: ILockingModule = container.resolve(Modules.LOCKING);

    const previous = await locking.execute(
      `email-delivery:${input.id}`,
      async () => {
        const [delivery] = await service.listEmailDeliveries({ id: input.id });
        if (!delivery) {
          throw new MedusaError(
            MedusaError.Types.NOT_FOUND,
            "No such email delivery.",
          );
        }
        const stalled =
          delivery.status === "attempted" &&
          Boolean(delivery.first_attempt_at) &&
          Date.now() - new Date(delivery.first_attempt_at!).getTime() >=
            SAFE_RETRY_WINDOW_MS;
        if (
          delivery.resolution ||
          (delivery.status !== "needs_review" && !stalled)
        ) {
          throw new MedusaError(
            MedusaError.Types.NOT_ALLOWED,
            "This email isn't waiting for review (it was sent, is still being retried, or was already reviewed).",
          );
        }

        const decided = {
          resolution: input.resolution,
          resolved_at: new Date(),
          resolved_by: input.user_id,
          resolution_note: input.note?.trim() || null,
        };
        await service.updateEmailDeliveries(
          input.resolution === "sent"
            ? {
                id: delivery.id,
                ...decided,
                status: "accepted",
                provider_id: input.provider_id!,
                accepted_at: new Date(),
                // Sent: the stored copy is no longer needed to retry.
                payload_ciphertext: null,
              }
            : { id: delivery.id, ...decided, status: "needs_review" },
        );

        return {
          id: delivery.id,
          status: delivery.status,
          provider_id: delivery.provider_id,
          accepted_at: delivery.accepted_at,
          payload_ciphertext: delivery.payload_ciphertext,
        } satisfies Snapshot;
      },
      { timeout: 30 },
    );

    return new StepResponse(
      { id: input.id, resolution: input.resolution },
      previous,
    );
  },
  async (previous, { container }) => {
    if (!previous) return;
    const service: EmailDeliveryModuleService = container.resolve(
      EMAIL_DELIVERY_MODULE,
    );
    await service.updateEmailDeliveries({
      ...previous,
      resolution: null,
      resolved_at: null,
      resolved_by: null,
      resolution_note: null,
    });
  },
);
