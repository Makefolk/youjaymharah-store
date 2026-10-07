import type { HttpTypes } from "@medusajs/types"

import { isComingSoon } from "./product"
import {
  COLOUR_OPTION,
  getProductCardImages,
  isVariantPurchasable,
  variantOptionValue,
  type ProductImage,
} from "./variants"

export function getCardGallery(
  product: HttpTypes.StoreProduct,
): ProductImage[] {
  const images = getProductCardImages({ ...product, variants: [] })
  for (const variant of product.variants ?? []) {
    if (variant.thumbnail) {
      images.push({ id: `${variant.id}-thumbnail`, url: variant.thumbnail })
    }
    images.push(...(variant.images ?? []))
  }
  const seen = new Set<string>()
  return images.filter(({ url }) => {
    if (!url || seen.has(url)) return false
    seen.add(url)
    return true
  })
}

export function getCardColourProduct(
  product: HttpTypes.StoreProduct,
  colour: string | null,
) {
  if (!colour) return product
  return {
    ...product,
    variants: (product.variants ?? []).filter(
      (variant) =>
        variantOptionValue(product, variant, COLOUR_OPTION)?.value === colour,
    ),
  }
}

export function getCardColourImage(
  product: HttpTypes.StoreProduct,
  colour: string,
) {
  const { variants } = getCardColourProduct(product, colour)
  return (
    variants?.find((variant) => variant.thumbnail)?.thumbnail ||
    variants
      ?.flatMap((variant) => variant.images ?? [])
      .find((image) => image.url)?.url ||
    getCardGallery(product)[0]?.url
  )
}

export function getCardStatus(
  product: HttpTypes.StoreProduct,
  newProduct = false,
) {
  if (isComingSoon(product)) return "Coming soon"
  const variants = product.variants ?? []
  if (
    variants.length &&
    variants.every(
      (variant) =>
        variant.manage_inventory === true &&
        typeof variant.inventory_quantity === "number" &&
        !isVariantPurchasable(variant, product),
    )
  )
    return "Sold out"
  return newProduct ? "New" : null
}
