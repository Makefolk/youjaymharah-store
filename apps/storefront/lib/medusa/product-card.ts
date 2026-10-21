import type { HttpTypes } from "@medusajs/types"

import { isComingSoon } from "./product"
import {
  COLOUR_OPTION,
  findVariant,
  getColourChoices,
  getProductCardImages,
  getSizeChoices,
  isVariantPurchasable,
  SIZE_OPTION,
  variantOptionValue,
  type OptionChoice,
  type OptionSelection,
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

export type QuickAddSize = OptionChoice & { variantId: string }

export type QuickAdd =
  /** Several sizes: show them and add the one picked. */
  | { mode: "sizes"; colour: string | null; sizes: QuickAddSize[] }
  /** One buyable variant for this colour: add it straight away. */
  | { mode: "direct"; colour: string | null; variantId: string }

/**
 * What a card's quick add offers, for the colour the card shows (its chosen
 * swatch, or the first colour that can be bought). Null when nothing can be
 * added from the card: coming soon, or sold out in every size.
 */
export function getQuickAdd(
  product: HttpTypes.StoreProduct,
  colour: string | null,
): QuickAdd | null {
  if (isComingSoon(product)) return null

  const colours = getColourChoices(product)
  const chosen =
    colour ??
    colours.find((choice) => choice.available)?.value ??
    colours[0]?.value ??
    null
  const selection: OptionSelection = chosen ? { [COLOUR_OPTION]: chosen } : {}
  // Size choices span every colour; offer only the sizes made in this one.
  const sizes = getSizeChoices(product, selection).flatMap((size) => {
    const variant = findVariant(product, {
      ...selection,
      [SIZE_OPTION]: size.value,
    })
    return variant ? [{ ...size, variantId: variant.id }] : []
  })

  if (sizes.length > 1) {
    return sizes.some((size) => size.available)
      ? { mode: "sizes", colour: chosen, sizes }
      : null
  }

  const variant = findVariant(product, {
    ...selection,
    ...(sizes[0] ? { [SIZE_OPTION]: sizes[0].value } : {}),
  })
  return variant && isVariantPurchasable(variant, product)
    ? { mode: "direct", colour: chosen, variantId: variant.id }
    : null
}
