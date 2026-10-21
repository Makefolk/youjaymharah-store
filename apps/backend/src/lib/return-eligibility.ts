/**
 * What a customer can still return from an order, under the store's return
 * policy (Settings -> Returns). Used by the storefront's "Request a return"
 * page and, again, when the request is submitted, so both agree.
 *
 * Each shipment has its own window, from its delivery. When staff shipped it
 * but never marked it delivered, the window runs from dispatch instead, so a
 * missed "Mark as delivered" doesn't stop the customer returning anything;
 * the published policy says so. Only units in a shipment can be returned:
 * packed but unsent units can't.
 */

export type ReturnPolicy = { enabled: boolean; window_days: number };

type Quantity = number | string | null | undefined;

export type EligibilityOrder = {
  status?: string | null;
  canceled_at?: Date | string | null;
  items?:
    | ({
        id: string;
        quantity: Quantity;
        detail?: {
          fulfilled_quantity?: Quantity;
          return_requested_quantity?: Quantity;
          return_received_quantity?: Quantity;
          return_dismissed_quantity?: Quantity;
          written_off_quantity?: Quantity;
        } | null;
      } | null)[]
    | null;
  fulfillments?:
    | ({
        canceled_at?: Date | string | null;
        shipped_at?: Date | string | null;
        delivered_at?: Date | string | null;
        items?:
          | ({ line_item_id?: string | null; quantity?: Quantity } | null)[]
          | null;
      } | null)[]
    | null;
};

/**
 * Why nothing can be returned, for the storefront to explain:
 * - disabled: the store has turned customer return requests off.
 * - canceled: the order was canceled.
 * - not_shipped: nothing has been sent yet.
 * - expired: the return window has closed for everything sent.
 * - nothing_left: everything sent is already being returned.
 */
export type ClosedReason =
  "disabled" | "canceled" | "not_shipped" | "expired" | "nothing_left";

export type ItemEligibility = {
  item_id: string;
  returnable_quantity: number;
  /** The last moment it can be requested; null while not yet shipped. */
  return_by: string | null;
};

export type ReturnEligibility = {
  open: boolean;
  reason: ClosedReason | null;
  items: ItemEligibility[];
};

const DAY_MS = 24 * 60 * 60 * 1000;

const num = (value: Quantity) => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const time = (value: Date | string | null | undefined) =>
  value ? new Date(value).getTime() : null;

export function getReturnEligibility(
  order: EligibilityOrder,
  policy: ReturnPolicy,
  now: Date = new Date(),
): ReturnEligibility {
  const windowMs = policy.window_days * DAY_MS;

  // Each line's shipped units, by the deadline of the shipment they went in.
  const shipmentsByItem = new Map<string, { returnBy: number; quantity: number }[]>();
  for (const fulfillment of order.fulfillments ?? []) {
    if (!fulfillment || fulfillment.canceled_at) continue;
    const start =
      time(fulfillment.delivered_at) ?? time(fulfillment.shipped_at);
    if (start === null) continue;
    for (const item of fulfillment.items ?? []) {
      if (!item?.line_item_id) continue;
      const shipments = shipmentsByItem.get(item.line_item_id) ?? [];
      shipments.push({ returnBy: start + windowMs, quantity: num(item.quantity) });
      shipmentsByItem.set(item.line_item_id, shipments);
    }
  }

  let anyStarted = false;
  let anyInWindow = false;
  const items = (order.items ?? [])
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => {
      const shipments = shipmentsByItem.get(item.id) ?? [];
      if (!shipments.length)
        return { item_id: item.id, returnable_quantity: 0, return_by: null };

      anyStarted = true;
      const open = shipments.filter(
        (shipment) => now.getTime() <= shipment.returnBy,
      );
      if (open.length) anyInWindow = true;

      const shipped = shipments.reduce((sum, s) => sum + s.quantity, 0);
      const openQuantity = open.reduce((sum, s) => sum + s.quantity, 0);
      const detail = item.detail ?? {};
      const alreadyReturning =
        num(detail.return_requested_quantity) +
        num(detail.return_received_quantity) +
        num(detail.return_dismissed_quantity) +
        num(detail.written_off_quantity);
      // Returns don't say which shipment they came from; count them against
      // closed shipments first, which leaves the customer the most.
      const returnable = Math.max(
        0,
        Math.min(openQuantity, shipped - alreadyReturning),
      );

      // The latest open deadline, or the last one that passed.
      const returnBy = Math.max(
        ...(open.length ? open : shipments).map((s) => s.returnBy),
      );

      return {
        item_id: item.id,
        returnable_quantity: policy.enabled ? returnable : 0,
        return_by: new Date(returnBy).toISOString(),
      };
    });

  let reason: ClosedReason | null = null;
  if (!policy.enabled) reason = "disabled";
  else if (order.status === "canceled" || order.canceled_at)
    reason = "canceled";
  else if (!anyStarted) reason = "not_shipped";
  else if (!anyInWindow) reason = "expired";
  else if (!items.some((item) => item.returnable_quantity > 0))
    reason = "nothing_left";

  return {
    open: reason === null,
    reason,
    items:
      reason === "canceled"
        ? items.map((item) => ({ ...item, returnable_quantity: 0 }))
        : items,
  };
}

/**
 * The first problem with a requested set of items, or null when every line
 * can be returned in the quantity asked for.
 */
export function findIneligibleRequest(
  eligibility: ReturnEligibility,
  requested: { id: string; quantity: number }[],
): string | null {
  if (!eligibility.open) return "This order can't be returned online.";
  if (!requested.length) return "Choose at least one item to return.";

  const byId = new Map(eligibility.items.map((item) => [item.item_id, item]));
  const seen = new Set<string>();
  for (const line of requested) {
    if (seen.has(line.id)) return "Each item can only be listed once.";
    seen.add(line.id);
    const item = byId.get(line.id);
    if (!item || item.returnable_quantity < 1)
      return "One of the items can no longer be returned.";
    if (line.quantity > item.returnable_quantity)
      return `Only ${item.returnable_quantity} of one item can be returned.`;
  }
  return null;
}
