import type { HttpTypes } from "@medusajs/types"

import { formatPrice, getProductPrice } from "@/lib/medusa/price"
import { getCardGallery, getCardStatus } from "@/lib/medusa/product-card"
import {
  getColourChoices,
  getSizeChoices,
  LOW_STOCK_THRESHOLD,
} from "@/lib/medusa/variants"

/**
 * What a product's link preview says, kept apart from the drawing so it can
 * be tested. Every line is true of the product now: no invented urgency.
 */
export type ProductCardContent = {
  /** The one reason to look now, most important first. */
  flag: string | null
  price: {
    amount: string
    original: string | null
    percentOff: number | null
    from: boolean
  } | null
  details: string | null
  action: string
  photos: string[]
}

/**
 * Stock left across the whole product, when every variant is counted and
 * none can be backordered; null when it isn't a simple count.
 */
function unitsLeft(product: HttpTypes.StoreProduct): number | null {
  const variants = product.variants ?? []
  if (
    !variants.length ||
    variants.some(
      (variant) =>
        variant.manage_inventory !== true ||
        variant.allow_backorder ||
        typeof variant.inventory_quantity !== "number",
    )
  ) {
    return null
  }
  return variants.reduce(
    (total, variant) => total + Math.max(0, variant.inventory_quantity ?? 0),
    0,
  )
}

export function getProductCardContent(
  product: HttpTypes.StoreProduct,
  isNew: boolean,
): ProductCardContent {
  const status = getCardStatus(product, isNew)
  const price = getProductPrice(product)
  const left = unitsLeft(product)
  const unavailable = status === "Coming soon" || status === "Sold out"

  const flag =
    status === "Coming soon" || status === "Sold out"
      ? status
      : price?.price.isOnSale
        ? "On sale"
        : left !== null && left > 0 && left <= LOW_STOCK_THRESHOLD
          ? `Only ${left} left`
          : status === "New"
            ? "New in"
            : null

  const colours = getColourChoices(product).length
  const sizes = getSizeChoices(product).map((choice) => choice.value)
  const details = [
    colours > 1 ? `${colours} colours` : null,
    sizes.length > 1 ? `Sizes ${sizes[0]}–${sizes[sizes.length - 1]}` : null,
  ]
    .filter(Boolean)
    .join(" · ")

  return {
    flag,
    price: price
      ? {
          amount: formatPrice(price.price.amount, price.price.currencyCode),
          original: price.price.isOnSale
            ? formatPrice(price.price.originalAmount, price.price.currencyCode)
            : null,
          percentOff: price.price.isOnSale ? price.price.percentOff : null,
          from: price.isRange,
        }
      : null,
    details: details || null,
    action: unavailable ? "Get notified" : "Buy now",
    photos: getCardGallery(product).map((image) => image.url),
  }
}

/** The lowest price among these products, formatted; null when none is. */
export function lowestPrice(products: HttpTypes.StoreProduct[]): string | null {
  const prices = products
    .map((product) => getProductPrice(product)?.price)
    .filter((price): price is NonNullable<typeof price> => Boolean(price))
  if (!prices.length) return null
  const lowest = prices.reduce((a, b) => (b.amount < a.amount ? b : a))
  return formatPrice(lowest.amount, lowest.currencyCode)
}

/** "24 pieces", "1 piece". */
export const pieces = (count: number) =>
  `${count} ${count === 1 ? "piece" : "pieces"}`
