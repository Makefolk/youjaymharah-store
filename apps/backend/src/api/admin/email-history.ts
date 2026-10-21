import type {
  FilterableNotificationProps,
  INotificationModuleService,
  MedusaContainer,
} from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

import { EMAIL_DELIVERY_MODULE } from "../../modules/email-delivery";
import type { EmailOutcomeName } from "../../modules/email-delivery/outcome";
import type EmailDeliveryModuleService from "../../modules/email-delivery/service";
import { emailDeliveryId } from "../../modules/resend/delivery";

/**
 * - sending: not confirmed yet; the workflow engine is still retrying.
 * - sent: Resend accepted it. `outcome` says what happened next, if known.
 * - failed: every attempt was refused, or it could not be rendered.
 * - needs_review: the result is uncertain and automatic retries stopped.
 */
export type EmailHistoryStatus = "sending" | "sent" | "failed" | "needs_review";

export type EmailHistoryEntry = {
  id: string;
  template: string;
  to: string;
  status: EmailHistoryStatus;
  created_at: string;
  sent_at: string | null;
  outcome: EmailOutcomeName | null;
  outcome_at: string | null;
  outcome_detail: string | null;
};

const iso = (value: Date | string | null | undefined) =>
  value ? new Date(value).toISOString() : null;

/**
 * Emails Medusa's notification module recorded, joined to the delivery ledger
 * the Resend provider keeps. One send can leave several notification rows
 * (each retry is recorded), so they are grouped by delivery identity and the
 * newest row stands for the group.
 */
export async function listEmailHistory(
  container: MedusaContainer,
  filters: FilterableNotificationProps,
  limit = 50,
): Promise<EmailHistoryEntry[]> {
  const notifications: INotificationModuleService = container.resolve(
    Modules.NOTIFICATION,
  );
  const deliveries: EmailDeliveryModuleService = container.resolve(
    EMAIL_DELIVERY_MODULE,
  );

  const rows = await notifications.listNotifications(
    { ...filters, channel: "email" },
    {
      select: ["id", "to", "template", "status", "provider_data", "created_at"],
      order: { created_at: "DESC" },
      // Leaves room for retry rows that collapse into one entry.
      take: limit * 4,
    },
  );

  const latest = new Map<string, (typeof rows)[number]>();
  const firstSeen = new Map<string, Date>();
  for (const row of rows) {
    const key = row.provider_data?.idempotency_key;
    const group = typeof key === "string" ? key : row.id;
    if (!latest.has(group)) latest.set(group, row);
    firstSeen.set(group, row.created_at);
  }

  const groups = [...latest.entries()].slice(0, limit);
  const ids = groups
    .map(([key]) => key)
    .filter((key) => key.startsWith("email:"))
    .map(emailDeliveryId);
  const ledger = ids.length
    ? await deliveries.listEmailDeliveries(
        { id: ids },
        {
          select: [
            "id",
            "status",
            "accepted_at",
            "outcome",
            "outcome_at",
            "outcome_detail",
          ],
        },
      )
    : [];
  const byId = new Map(ledger.map((row) => [row.id, row]));

  return groups.map(([key, row]) => {
    const delivery = key.startsWith("email:")
      ? byId.get(emailDeliveryId(key))
      : undefined;

    let status: EmailHistoryStatus;
    if (delivery?.status === "accepted") status = "sent";
    else if (delivery?.status === "needs_review") status = "needs_review";
    else if (row.status === "success") status = "sent";
    else if (row.status === "failure") status = "failed";
    else status = "sending";

    return {
      id: key.startsWith("email:") ? emailDeliveryId(key) : row.id,
      template: row.template,
      to: row.to,
      status,
      created_at: iso(firstSeen.get(key) ?? row.created_at)!,
      sent_at: iso(delivery?.accepted_at),
      outcome: (delivery?.outcome as EmailOutcomeName | null) ?? null,
      outcome_at: iso(delivery?.outcome_at),
      outcome_detail: delivery?.outcome_detail ?? null,
    };
  });
}
