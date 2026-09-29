import type { HttpTypes } from "@medusajs/types"

import { metaImage, metaText } from "./metadata"
import { isComingSoon } from "./product"

/** The shared option titles set up in the admin (Products › Options). */
export const COLOUR_OPTION = "Colour"
export const SIZE_OPTION = "Size"

/** At or below this many in stock, show "Only a few left". */
export const LOW_STOCK_THRESHOLD = 3

type Product = Pick<HttpTypes.StoreProduct, "metadata" | "options"> & {
  variants?: HttpTypes.StoreProductVariant[] | null
  images?: HttpTypes.StoreProduct["images"]
  thumbnail?: string | null
}

type Variant = HttpTypes.StoreProductVariant

type OptionValue = HttpTypes.StoreProductOptionValue

/**
 * Chosen option values by option title, e.g. `{ Colour: "Black", Size: "M" }`.
 * Titles match case-insensitively.
 */
export type OptionSelection = Record<string, string | null | undefined>

function sameTitle(a: string | null | undefined, b: string): boolean {
  return a?.toLowerCase() === b.toLowerCase()
}

function selected(selection: OptionSelection, title: string) {
  const entry = Object.entries(selection).find(([key]) => sameTitle(key, title))
  return entry?.[1] || undefined
}

function optionTitle(product: Product, value: OptionValue): string | null {
  return (
    value.option?.title ??
    product.options?.find((option) => option.id === value.option_id)?.title ??
    null
  )
}

/**
 * The value a variant has for an option, such as its Colour. Needs
 * `*variants.options` in `fields`, plus `*options` when the values don't carry
 * their option.
 */
export function variantOptionValue(
  product: Product,
  variant: Variant,
  title: string,
): OptionValue | undefined {
  return (variant.options ?? []).find((value) =>
    sameTitle(optionTitle(product, value), title),
  )
}

export type StockStatus =
  "in_stock" | "low_stock" | "backorder" | "sold_out" | "coming_soon"

/**
 * Whether a variant can be bought, and how to word it. Needs
 * `+variants.inventory_quantity` in `fields`: without it every tracked variant
 * reads as sold out. Pass the product to account for "coming soon".
 */
export function getVariantStock(
  variant: Partial<
    Pick<Variant, "manage_inventory" | "allow_backorder" | "inventory_quantity">
  >,
  product?: Pick<HttpTypes.StoreProduct, "metadata">,
): StockStatus {
  if (product && isComingSoon(product)) {
    return "coming_soon"
  }

  if (variant.manage_inventory === false) {
    return "in_stock"
  }

  const quantity = variant.inventory_quantity ?? 0

  if (quantity > 0) {
    return quantity <= LOW_STOCK_THRESHOLD ? "low_stock" : "in_stock"
  }

  return variant.allow_backorder ? "backorder" : "sold_out"
}

/** "Add to bag" for these; "Notify me" for sold out and coming soon. */
export function canPurchase(status: StockStatus): boolean {
  return (
    status === "in_stock" || status === "low_stock" || status === "backorder"
  )
}

export function isVariantPurchasable(
  variant: Parameters<typeof getVariantStock>[0],
  product?: Pick<HttpTypes.StoreProduct, "metadata">,
): boolean {
  return canPurchase(getVariantStock(variant, product))
}

export type OptionChoice = {
  value: string
  /** A colour's swatch, such as "#1c1c1c", from the option value's metadata. */
  hex: string | null
  /** A print's swatch image, from the option value's metadata. */
  swatchImage: string | null
  /**
   * A variant with this value, and the other chosen options, can be bought.
   * Show unavailable choices crossed out rather than hiding them.
   */
  available: boolean
}

/**
 * The real choices for one option, in the admin's order. Built from the
 * variants: Colour and Size are shared options, so `product.options[].values`
 * lists every value in the store, not just the ones this product comes in.
 *
 * Availability follows the other chosen options, so after picking a colour,
 * sizes sold out in that colour show as unavailable.
 */
export function getOptionChoices(
  product: Product,
  title: string,
  selection: OptionSelection = {},
): OptionChoice[] {
  const others = Object.entries(selection).filter(
    (entry): entry is [string, string] =>
      Boolean(entry[1]) && !sameTitle(entry[0], title),
  )

  const choices = new Map<
    string,
    OptionChoice & { rank: number; order: number }
  >()

  for (const variant of product.variants ?? []) {
    const value = variantOptionValue(product, variant, title)

    if (!value) {
      continue
    }

    const matchesOthers = others.every(
      ([otherTitle, otherValue]) =>
        variantOptionValue(product, variant, otherTitle)?.value === otherValue,
    )
    const available = matchesOthers && isVariantPurchasable(variant, product)
    const existing = choices.get(value.value)

    if (existing) {
      existing.available ||= available
      continue
    }

    const hex = metaText(value.metadata?.hex)

    choices.set(value.value, {
      value: value.value,
      hex: hex && /^#[0-9a-f]{3,8}$/i.test(hex) ? hex : null,
      swatchImage: metaImage(value.metadata?.swatch_image),
      available,
      rank: value.rank ?? Number.MAX_SAFE_INTEGER,
      order: choices.size,
    })
  }

  return [...choices.values()]
    .sort((a, b) => a.rank - b.rank || a.order - b.order)
    .map(({ rank: _rank, order: _order, ...choice }) => choice)
}

export function getColourChoices(
  product: Product,
  selection?: OptionSelection,
): OptionChoice[] {
  return getOptionChoices(product, COLOUR_OPTION, selection)
}

export function getSizeChoices(
  product: Product,
  selection?: OptionSelection,
): OptionChoice[] {
  return getOptionChoices(product, SIZE_OPTION, selection)
}

/**
 * The variant matching the selection, once every option it has is chosen.
 * A product without options (a single variant) matches straight away.
 */
export function findVariant(
  product: Product,
  selection: OptionSelection,
): Variant | undefined {
  return (product.variants ?? []).find((variant) =>
    (variant.options ?? []).every((value) => {
      const title = optionTitle(product, value)
      return title !== null && selected(selection, title) === value.value
    }),
  )
}

export type ProductImage = { id: string; url: string }

/**
 * The photos to show for the current selection: the chosen variant's, or,
 * with only a colour chosen, the first variant in that colour. Falls back to
 * the product gallery when the variant has none. Needs `*variants.images` and
 * `*images` and `+variants.thumbnail` in `fields`.
 */
export function getSelectionImages(
  product: Product,
  selection: OptionSelection = {},
): { images: ProductImage[]; thumbnail: string | null } {
  const colour = selected(selection, COLOUR_OPTION)
  const variant =
    findVariant(product, selection) ??
    (colour
      ? (product.variants ?? []).find(
          (candidate) =>
            variantOptionValue(product, candidate, COLOUR_OPTION)?.value ===
            colour,
        )
      : undefined)

  const variantImages = (variant?.images ?? []).filter((image) => image.url)

  return {
    images: variantImages.length ? variantImages : (product.images ?? []),
    thumbnail:
      variant?.thumbnail ||
      variantImages[0]?.url ||
      product.thumbnail ||
      product.images?.[0]?.url ||
      null,
  }
}

/**
 * Carousel slides for the chosen colour/variant, with its thumbnail first and
 * duplicate URLs removed. Falls back to product media, then an empty array
 * for an image placeholder. Use PRODUCT_CARD_MEDIA_FIELDS for listing reads.
 */
export function getProductCardImages(
  product: Product,
  selection: OptionSelection = {},
): ProductImage[] {
  const { images, thumbnail } = getSelectionImages(product, selection)
  const seen = new Set<string>()
  const cover = thumbnail
    ? (images.find((image) => image.url === thumbnail) ?? {
        id: "thumbnail",
        url: thumbnail,
      })
    : null

  return (cover ? [cover, ...images] : images).filter((image) => {
    if (!image.url || seen.has(image.url)) {
      return false
    }

    seen.add(image.url)
    return true
  })
}
