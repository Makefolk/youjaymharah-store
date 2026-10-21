import { createHash } from "node:crypto";
import { MedusaError } from "@medusajs/framework/utils";
import type { ILockingModule } from "@medusajs/framework/types";
import type { CreateEmailOptions } from "resend";
import type EmailDeliveryModuleService from "../email-delivery/service";
import { openSnapshot, sealSnapshot } from "./snapshot";

// Leave a margin before Resend expires its 24-hour idempotency record.
export const SAFE_RETRY_WINDOW_MS = 23 * 60 * 60 * 1000;

/** The ledger row for a notification's `provider_data.idempotency_key`. */
export function emailDeliveryId(key: string): string {
  return `emdel_${createHash("sha256").update(key).digest("hex")}`;
}

export async function deliverEmail({
  service,
  locking,
  key,
  encryptionKey,
  prepare,
  send,
}: {
  service: EmailDeliveryModuleService;
  locking: ILockingModule;
  key: string;
  encryptionKey: Buffer;
  prepare: () => Promise<CreateEmailOptions>;
  send: (payload: CreateEmailOptions, key: string) => Promise<string>;
}): Promise<{ id: string }> {
  const id = emailDeliveryId(key);
  return locking.execute(
    `email-delivery:${id}`,
    async () => {
      let [delivery] = await service.listEmailDeliveries({ id });
      if (delivery?.status === "accepted") {
        if (!delivery.provider_id)
          throw new MedusaError(
            MedusaError.Types.UNEXPECTED_STATE,
            "Accepted email is missing its provider receipt; review required.",
          );
        return { id: delivery.provider_id };
      }
      if (delivery?.status === "needs_review")
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "Email delivery requires review; automatic resend is blocked.",
        );
      if (
        delivery?.first_attempt_at &&
        Date.now() - new Date(delivery.first_attempt_at).getTime() >=
          SAFE_RETRY_WINDOW_MS
      ) {
        await service.updateEmailDeliveries({ id, status: "needs_review" });
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "Email outcome is uncertain and the safe retry window has elapsed; review required.",
        );
      }
      if (!delivery) {
        delivery = await service.createEmailDeliveries({
          id,
          payload_ciphertext: sealSnapshot(await prepare(), id, encryptionKey),
        });
      }
      if (!delivery.payload_ciphertext)
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "Email snapshot is missing; automatic resend is blocked.",
        );
      const payload = openSnapshot<CreateEmailOptions>(
        delivery.payload_ciphertext,
        id,
        encryptionKey,
      );
      await service.updateEmailDeliveries({
        id,
        status: "attempted",
        first_attempt_at: delivery.first_attempt_at ?? new Date(),
        attempts: delivery.attempts + 1,
      });
      const providerId = await send(payload, key);
      if (!providerId)
        throw new MedusaError(
          MedusaError.Types.UNEXPECTED_STATE,
          "Email provider returned no receipt; delivery remains uncertain.",
        );
      await service.updateEmailDeliveries({
        id,
        status: "accepted",
        provider_id: providerId,
        accepted_at: new Date(),
        payload_ciphertext: null,
      });
      return { id: providerId };
    },
    { timeout: 60 },
  );
}
