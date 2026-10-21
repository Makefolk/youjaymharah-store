import type { HttpTypes } from "@medusajs/types"

/**
 * Reading an order for the customer: where it has got to, what was shipped
 * with which tracking, and the payment state in plain words. Pure, so pages
 * and tests share it.
 */

/** What the order page needs beyond the store API's default fields. */
export const ORDER_PAGE_FIELDS = [
  "+payment_status",
  "+fulfillment_status",
  "+customer_id",
  "*fulfillments",
  "*fulfillments.labels",
  "*fulfillments.items",
].join(",")

export const ORDER_LIST_FIELDS = [
  "id",
  "display_id",
  "created_at",
  "status",
  "total",
  "currency_code",
  "+payment_status",
  "+fulfillment_status",
  "*items",
].join(",")

export type OrderStage =
  "placed" | "packed" | "shipped" | "delivered" | "canceled"

type ProgressOrder = Pick<HttpTypes.StoreOrder, "status"> & {
  fulfillment_status?: string | null
}

/** The four steps a customer sees, in order. */
export const ORDER_STEPS: { stage: OrderStage; label: string }[] = [
  { stage: "placed", label: "Order placed" },
  { stage: "packed", label: "Being prepared" },
  { stage: "shipped", label: "On its way" },
  { stage: "delivered", label: "Delivered" },
]

export type OrderProgress = {
  stage: OrderStage
  /** One line for the order's heading, e.g. "Partly shipped". */
  label: string
  /** True when only some items have reached `stage`. */
  partial: boolean
}

export function getOrderProgress(order: ProgressOrder): OrderProgress {
  if (order.status === "canceled") {
    return { stage: "canceled", label: "Canceled", partial: false }
  }

  switch (order.fulfillment_status) {
    case "delivered":
      return { stage: "delivered", label: "Delivered", partial: false }
    case "partially_delivered":
      return { stage: "delivered", label: "Partly delivered", partial: true }
    case "shipped":
      return { stage: "shipped", label: "On its way", partial: false }
    case "partially_shipped":
      return { stage: "shipped", label: "Partly shipped", partial: true }
    case "fulfilled":
      return { stage: "packed", label: "Being prepared", partial: false }
    case "partially_fulfilled":
      return { stage: "packed", label: "Being prepared", partial: true }
    default:
      return { stage: "placed", label: "Order placed", partial: false }
  }
}

/**
 * Plain words for the payment state. "Authorized" money is held but not yet
 * taken; to a shopper that is simply paid.
 */
export function getPaymentLabel(status: string | null | undefined): string {
  switch (status) {
    case "captured":
    case "authorized":
    case "partially_captured":
    case "partially_authorized":
      return "Paid"
    case "refunded":
      return "Refunded"
    case "partially_refunded":
      return "Partly refunded"
    case "canceled":
      return "Payment canceled"
    case "not_paid":
    case "awaiting":
    case "requires_action":
      return "Awaiting payment"
    default:
      return "Payment pending"
  }
}

export type Shipment = {
  id: string
  shippedAt: string | null
  deliveredAt: string | null
  /** Line item ids in this shipment. */
  itemIds: string[]
  tracking: { number: string | null; url: string | null }[]
}

type ShipmentFulfillment = {
  id: string
  canceled_at?: string | Date | null
  shipped_at?: string | Date | null
  delivered_at?: string | Date | null
  labels?:
    | {
        tracking_number?: string | null
        tracking_url?: string | null
      }[]
    | null
  items?: { line_item_id?: string | null }[] | null
}

const iso = (value: string | Date | null | undefined) =>
  value ? new Date(value).toISOString() : null

const httpUrl = (value: string | null | undefined) =>
  value && /^https?:\/\//i.test(value) ? value : null

/** Shipments that have left, oldest first, with their tracking. */
export function getShipments(
  fulfillments: ShipmentFulfillment[] | null | undefined,
): Shipment[] {
  return (fulfillments ?? [])
    .filter((fulfillment) => !fulfillment.canceled_at && fulfillment.shipped_at)
    .map((fulfillment) => ({
      id: fulfillment.id,
      shippedAt: iso(fulfillment.shipped_at),
      deliveredAt: iso(fulfillment.delivered_at),
      itemIds: (fulfillment.items ?? [])
        .map((item) => item.line_item_id)
        .filter((id): id is string => Boolean(id)),
      tracking: (fulfillment.labels ?? [])
        .map((label) => ({
          number: label.tracking_number?.trim() || null,
          url: httpUrl(label.tracking_url?.trim()),
        }))
        .filter((label) => label.number || label.url),
    }))
    .sort((a, b) => (a.shippedAt ?? "").localeCompare(b.shippedAt ?? ""))
}

export function getReturnStatusLabel(status: string): string {
  switch (status) {
    case "requested":
      return "Requested"
    case "received":
      return "Received"
    case "partially_received":
      return "Partly received"
    case "open":
      return "In progress"
    default:
      return status.replaceAll("_", " ")
  }
}

/** "#1042" as on the confirmation email. */
export function formatOrderNumber(
  displayId: number | string | null | undefined,
) {
  return displayId === null || displayId === undefined ? "" : `#${displayId}`
}
