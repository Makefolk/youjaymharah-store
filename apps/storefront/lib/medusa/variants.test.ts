import type { HttpTypes } from "@medusajs/types"
import { describe, expect, it } from "vitest"

import {
  findVariant,
  getColourChoices,
  getOptionChoices,
  getProductCardImages,
  getSelectionImages,
  getSizeChoices,
  getVariantStock,
  isVariantPurchasable,
  LOW_STOCK_THRESHOLD,
} from "./variants"

const COLOUR_ID = "opt_colour"
const SIZE_ID = "opt_size"

type ValueSpec = {
  value: string
  rank?: number
  metadata?: Record<string, unknown>
}

function optionValue(optionId: string, spec: ValueSpec) {
  return {
    id: `${optionId}_${spec.value}`,
    value: spec.value,
    rank: spec.rank,
    option_id: optionId,
    metadata: spec.metadata ?? null,
  } as HttpTypes.StoreProductOptionValue
}

function makeVariant(
  id: string,
  colour: ValueSpec,
  size: ValueSpec,
  stock: Partial<HttpTypes.StoreProductVariant> = {},
) {
  return {
    id,
    title: `${colour.value} / ${size.value}`,
    manage_inventory: true,
    allow_backorder: false,
    inventory_quantity: 10,
    options: [optionValue(COLOUR_ID, colour), optionValue(SIZE_ID, size)],
    ...stock,
  } as HttpTypes.StoreProductVariant
}

const black = { value: "Black", rank: 1, metadata: { hex: "#1c1c1c" } }
const floral = {
  value: "Floral",
  rank: 0,
  metadata: { hex: "", swatch_image: "https://pub.r2.dev/floral.jpg" },
}
const small = { value: "S", rank: 0 }
const medium = { value: "M", rank: 1 }

function product(
  variants: HttpTypes.StoreProductVariant[],
  extra: Partial<HttpTypes.StoreProduct> = {},
) {
  return {
    metadata: null,
    options: [
      { id: COLOUR_ID, title: "Colour" },
      { id: SIZE_ID, title: "Size" },
    ] as HttpTypes.StoreProductOption[],
    variants,
    images: [{ id: "img_main", url: "https://pub.r2.dev/main.jpg" }],
    thumbnail: "https://pub.r2.dev/main-thumb.jpg",
    ...extra,
  } as HttpTypes.StoreProduct
}

describe("getVariantStock", () => {
  it("reads untracked stock as in stock", () => {
    expect(
      getVariantStock({ manage_inventory: false, inventory_quantity: 0 }),
    ).toBe("in_stock")
  })

  it("flags low stock at the threshold", () => {
    expect(
      getVariantStock({
        manage_inventory: true,
        inventory_quantity: LOW_STOCK_THRESHOLD,
      }),
    ).toBe("low_stock")
    expect(
      getVariantStock({
        manage_inventory: true,
        inventory_quantity: LOW_STOCK_THRESHOLD + 1,
      }),
    ).toBe("in_stock")
  })

  it("separates backorder from sold out", () => {
    expect(
      getVariantStock({
        manage_inventory: true,
        inventory_quantity: 0,
        allow_backorder: true,
      }),
    ).toBe("backorder")
    expect(
      getVariantStock({
        manage_inventory: true,
        inventory_quantity: 0,
        allow_backorder: false,
      }),
    ).toBe("sold_out")
  })

  it("treats a missing quantity as sold out, so a forgotten field shows", () => {
    expect(getVariantStock({ manage_inventory: true })).toBe("sold_out")
  })

  it("puts coming soon above stock", () => {
    expect(
      getVariantStock(
        { manage_inventory: false },
        { metadata: { coming_soon: true } },
      ),
    ).toBe("coming_soon")
    expect(
      isVariantPurchasable(
        { manage_inventory: false },
        { metadata: { coming_soon: true } },
      ),
    ).toBe(false)
  })
})

describe("option choices", () => {
  const p = product([
    makeVariant("black-s", black, small),
    makeVariant("black-m", black, medium, { inventory_quantity: 0 }),
    makeVariant("floral-s", floral, small, { inventory_quantity: 0 }),
    makeVariant("floral-m", floral, medium),
  ])

  it("lists only the product's values, in the admin's order, with swatches", () => {
    expect(getColourChoices(p)).toEqual([
      {
        value: "Floral",
        hex: null,
        swatchImage: "https://pub.r2.dev/floral.jpg",
        available: true,
      },
      { value: "Black", hex: "#1c1c1c", swatchImage: null, available: true },
    ])
  })

  it("follows the other chosen options for availability", () => {
    expect(
      getSizeChoices(p, { Colour: "Black" }).map((c) => [c.value, c.available]),
    ).toEqual([
      ["S", true],
      ["M", false],
    ])
    expect(
      getSizeChoices(p, { colour: "Floral" }).map((c) => [
        c.value,
        c.available,
      ]),
    ).toEqual([
      ["S", false],
      ["M", true],
    ])
  })

  it("ignores empty selections", () => {
    expect(
      getSizeChoices(p, { Colour: "" }).every((choice) => choice.available),
    ).toBe(true)
  })

  it("reads option titles from the values when present", () => {
    const withTitles = product(
      [
        {
          ...makeVariant("a", black, small),
          options: [
            {
              ...optionValue(COLOUR_ID, black),
              option: { id: COLOUR_ID, title: "Colour" },
            },
          ],
        } as HttpTypes.StoreProductVariant,
      ],
      { options: null },
    )
    expect(getOptionChoices(withTitles, "Colour").map((c) => c.value)).toEqual([
      "Black",
    ])
  })

  it("rejects a malformed hex", () => {
    const odd = product([
      makeVariant("x", { value: "Odd", metadata: { hex: "red" } }, small),
    ])
    expect(getColourChoices(odd)[0].hex).toBeNull()
  })
})

describe("findVariant", () => {
  const p = product([
    makeVariant("black-s", black, small),
    makeVariant("black-m", black, medium),
  ])

  it("finds the variant once every option is chosen", () => {
    expect(findVariant(p, { Colour: "Black", Size: "M" })?.id).toBe("black-m")
  })

  it("returns nothing until every option is chosen", () => {
    expect(findVariant(p, { Colour: "Black" })).toBeUndefined()
    expect(findVariant(p, { Colour: "Black", Size: "XL" })).toBeUndefined()
  })

  it("matches a product without options straight away", () => {
    const single = product([
      { id: "only", options: [] } as unknown as HttpTypes.StoreProductVariant,
    ])
    expect(findVariant(single, {})?.id).toBe("only")
  })
})

describe("getSelectionImages", () => {
  const blackImages = [{ id: "img_black", url: "https://pub.r2.dev/black.jpg" }]
  const p = product([
    makeVariant("black-s", black, small, {
      images: blackImages,
      thumbnail: "https://pub.r2.dev/black-thumb.jpg",
    } as Partial<HttpTypes.StoreProductVariant>),
    makeVariant("black-m", black, medium, {
      images: blackImages,
    } as Partial<HttpTypes.StoreProductVariant>),
    makeVariant("floral-s", floral, small),
  ])

  it("uses the colour's photos as soon as a colour is chosen", () => {
    expect(getSelectionImages(p, { Colour: "Black" })).toEqual({
      images: blackImages,
      thumbnail: "https://pub.r2.dev/black-thumb.jpg",
    })
  })

  it("falls back to the product gallery", () => {
    expect(getSelectionImages(p, { Colour: "Floral", Size: "S" })).toEqual({
      images: [{ id: "img_main", url: "https://pub.r2.dev/main.jpg" }],
      thumbnail: "https://pub.r2.dev/main-thumb.jpg",
    })
    expect(getSelectionImages(p).images[0].id).toBe("img_main")
  })

  it("keeps the selected colour when a variant has photos but no thumbnail", () => {
    expect(
      getSelectionImages(p, { Colour: "Black", Size: "M" }).thumbnail,
    ).toBe(blackImages[0].url)
  })

  it("puts the variant thumbnail first without repeating it in the carousel", () => {
    expect(getProductCardImages(p, { Colour: "Black", Size: "S" })).toEqual([
      { id: "thumbnail", url: "https://pub.r2.dev/black-thumb.jpg" },
      ...blackImages,
    ])
    expect(getProductCardImages(p, { Colour: "Black", Size: "M" })).toEqual(
      blackImages,
    )
  })

  it("supports product-only media and products with no images", () => {
    expect(getProductCardImages(product([], { thumbnail: null }))).toEqual([
      { id: "img_main", url: "https://pub.r2.dev/main.jpg" },
    ])
    expect(
      getProductCardImages(product([], { thumbnail: null, images: [] })),
    ).toEqual([])
  })
})
