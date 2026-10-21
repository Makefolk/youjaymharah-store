import type { HttpTypes } from "@medusajs/types"

/**
 * The shopping bag's arithmetic, from the cart Medusa returns. Line totals
 * aren't in the default cart fields, so a line is priced from its unit
 * price; the cart's own totals are used for the summary.
 */

type Line = Pick<
  HttpTypes.StoreCartLineItem,
  "unit_price" | "quantity" | "compare_at_unit_price"
>

export function getLinePrice(line: Line): {
  total: number
  /** The pre-sale total, only when the line is on sale. */
  compareAt: number | null
} {
  const quantity = Number(line.quantity ?? 0)
  const unit = Number(line.unit_price ?? 0)
  const compare = Number(line.compare_at_unit_price ?? 0)
  return {
    total: unit * quantity,
    compareAt: compare > unit ? compare * quantity : null,
  }
}

export type BagSummary = {
  count: number
  subtotal: number
  discount: number
  total: number
}

export function getBagSummary(
  cart: Pick<
    HttpTypes.StoreCart,
    "items" | "item_subtotal" | "subtotal" | "discount_total" | "total"
  >,
): BagSummary {
  const items = cart.items ?? []
  const fromLines = items.reduce(
    (sum, item) => sum + getLinePrice(item).total,
    0,
  )
  const subtotal = Number(cart.item_subtotal ?? cart.subtotal ?? fromLines)
  const discount = Number(cart.discount_total ?? 0)
  return {
    count: items.reduce((sum, item) => sum + Number(item.quantity ?? 0), 0),
    subtotal,
    discount,
    total: Number(cart.total ?? subtotal - discount),
  }
}

/** "Black / M" as "Black · M", the way the product page reads. */
export function formatVariantTitle(title: string | null | undefined): string {
  return (title ?? "")
    .split("/")
    .map((part) => part.trim())
    .filter((part) => part && part.toLowerCase() !== "default variant")
    .join(" · ")
}

/** Most of one item a shopper can put in the bag from the stepper. */
export const MAX_LINE_QUANTITY = 10
