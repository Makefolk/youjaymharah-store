import type {
  INotificationModuleService,
  MedusaContainer,
} from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

import { EMAIL_DELIVERY_MODULE } from "../../modules/email-delivery";
import type EmailDeliveryModuleService from "../../modules/email-delivery/service";
import {
  emailDeliveryId,
  SAFE_RETRY_WINDOW_MS,
} from "../../modules/resend/delivery";

export type EmailReviewEntry = {
  id: string;
  /**
   * - needs_review: automatic sending stopped because the outcome is unknown.
   * - stalled: attempted over a day ago with no answer; it will be blocked
   *   the next time anything retries it.
   */
  state: "needs_review" | "stalled";
  attempts: number;
  first_attempt_at: string | null;
  /** From the notification that sent it; null when that record is gone. */
  template: string | null;
  to: string | null;
  resource_type: string | null;
  resource_id: string | null;
};

/** The oldest first: they have waited longest. */
const LIMIT = 100;

/**
 * Emails whose fate nobody knows yet, oldest first: blocked for review, or
 * attempted so long ago that retrying would risk a duplicate. Resolved ones
 * are left out.
 *
 * The ledger stores only a hash of each email's identity, so the template,
 * recipient and order come from the notification records it was sent from,
 * matched by hashing their identities.
 */
export async function listEmailReviewQueue(
  container: MedusaContainer,
): Promise<{ deliveries: EmailReviewEntry[]; count: number }> {
  const ledger: EmailDeliveryModuleService = container.resolve(
    EMAIL_DELIVERY_MODULE,
  );
  const notifications: INotificationModuleService = container.resolve(
    Modules.NOTIFICATION,
  );

  const [rows, count] = await ledger.listAndCountEmailDeliveries(
    {
      resolution: null,
      $or: [
        { status: "needs_review" },
        {
          status: "attempted",
          first_attempt_at: {
            $lte: new Date(Date.now() - SAFE_RETRY_WINDOW_MS),
          },
        },
      ],
    },
    {
      take: LIMIT,
      order: { created_at: "ASC" },
      select: ["id", "status", "attempts", "first_attempt_at", "created_at"],
    },
  );
  if (!rows.length) return { deliveries: [], count };

  // The notification is recorded as the send starts, so it is no older than
  // an hour before its ledger row.
  const since = new Date(
    Math.min(...rows.map((row) => new Date(row.created_at).getTime())) -
      60 * 60 * 1000,
  );
  const sent = await notifications.listNotifications(
    { channel: "email", created_at: { $gte: since.toISOString() } },
    {
      select: [
        "to",
        "template",
        "resource_type",
        "resource_id",
        "provider_data",
      ],
      take: 5000,
    },
  );
  const byDelivery = new Map<string, (typeof sent)[number]>();
  for (const notification of sent) {
    const key = notification.provider_data?.idempotency_key;
    if (typeof key === "string" && key.startsWith("email:"))
      byDelivery.set(emailDeliveryId(key), notification);
  }

  return {
    count,
    deliveries: rows.map((row) => {
      const notification = byDelivery.get(row.id);
      return {
        id: row.id,
        state: row.status === "needs_review" ? "needs_review" : "stalled",
        attempts: row.attempts,
        first_attempt_at: row.first_attempt_at
          ? new Date(row.first_attempt_at).toISOString()
          : null,
        template: notification?.template ?? null,
        to: notification?.to ?? null,
        resource_type: notification?.resource_type ?? null,
        resource_id: notification?.resource_id ?? null,
      };
    }),
  };
}
