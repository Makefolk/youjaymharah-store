import type { HttpTypes } from "@medusajs/types"

import { metaText } from "./metadata"
import { isComingSoon } from "./product"
import {
  canPurchase,
  getOptionChoices,
  getVariantStock,
  type OptionSelection,
  type StockStatus,
} from "./variants"

/**
 * What the product page's main button does, from the current selection:
 * - choose: an option is still missing; pressing it asks for that option.
 * - add: the chosen variant can be bought.
 * - notify: the chosen variant (or the whole product) is sold out or coming
 *   soon; pressing it signs the shopper up for an email.
 */
export type PurchaseState =
  | { action: "choose"; missing: string[] }
  | { action: "add"; stock: StockStatus }
  | { action: "notify"; stock: StockStatus }

type Product = Parameters<typeof getOptionChoices>[0] &
  Pick<HttpTypes.StoreProduct, "metadata">

export function getPurchaseState(
  product: Product,
  selection: OptionSelection,
  variant: HttpTypes.StoreProductVariant | undefined,
): PurchaseState {
  if (isComingSoon(product)) {
    return { action: "notify", stock: "coming_soon" }
  }

  if (!variant) {
    const missing = (product.options ?? [])
      .map((option) => option.title)
      .filter((title) => !selection[title])
    // Every variant sold out: there is nothing to choose between.
    const anyAvailable = (product.options ?? []).every((option) =>
      getOptionChoices(product, option.title).some(
        (choice) => choice.available,
      ),
    )
    return anyAvailable || !product.options?.length
      ? { action: "choose", missing }
      : { action: "notify", stock: "sold_out" }
  }

  const stock = getVariantStock(variant, product)
  return canPurchase(stock)
    ? { action: "add", stock }
    : { action: "notify", stock }
}

/** "Choose a size", or "Choose a colour and size". */
export function describeMissing(missing: string[]): string {
  const names = missing.map((title) => title.toLowerCase())
  if (!names.length) return ""
  return names.length === 1
    ? `Choose a ${names[0]}`
    : `Choose a ${names.slice(0, -1).join(", ")} and ${names.at(-1)}`
}

/** A short line under the button, or null when there is nothing to add. */
export function getStockMessage(stock: StockStatus): string | null {
  switch (stock) {
    case "low_stock":
      return "Only a few left"
    case "backorder":
      return "Available to order. It ships as soon as it's back in stock."
    case "sold_out":
      return "Sold out. We'll email you when it's back."
    case "coming_soon":
      return "Coming soon. We'll email you when it launches."
    default:
      return null
  }
}

export type ProductDetail = { label: string; value: string }

/** Material, fit and care for the Details section, when set. */
export function getProductDetails(
  product: Pick<HttpTypes.StoreProduct, "material" | "metadata">,
): ProductDetail[] {
  return [
    { label: "Material", value: metaText(product.material) },
    { label: "Fit", value: metaText(product.metadata?.fit) },
    { label: "Care", value: metaText(product.metadata?.care) },
  ].filter((detail): detail is ProductDetail => Boolean(detail.value))
}

/** Items in the bag, counting quantities, for the header's bag icon. */
export function getBagCount(
  cart: { items?: { quantity?: number | null }[] | null } | null | undefined,
): number {
  return (cart?.items ?? []).reduce(
    (total, item) => total + Number(item.quantity ?? 0),
    0,
  )
}
