import type { HttpTypes } from "@medusajs/types"
import { describe, expect, it } from "vitest"

import { getProductCardContent, lowestPrice, pieces } from "./content"

const priced = (amount: number, sale = false, stock?: number) => ({
  id: `variant_${amount}_${stock ?? "untracked"}`,
  manage_inventory: stock !== undefined,
  allow_backorder: false,
  inventory_quantity: stock,
  calculated_price: {
    calculated_amount: amount,
    original_amount: sale ? 200000 : amount,
    currency_code: "ngn",
    calculated_price: { price_list_type: sale ? "sale" : null },
  },
})

const product = (
  variants: Record<string, unknown>[],
  metadata: Record<string, unknown> = {},
) =>
  ({
    id: "product_coat",
    title: "Wool coat",
    handle: "wool-coat",
    thumbnail: "https://images.example/coat.jpg",
    metadata,
    variants,
  }) as unknown as HttpTypes.StoreProduct

describe("product link previews", () => {
  it("lead with a sale, showing both prices and the saving", () => {
    const content = getProductCardContent(product([priced(150000, true)]), true)
    expect(content.flag).toBe("On sale")
    expect(content.price).toMatchObject({ percentOff: 25, from: false })
    expect(content.price?.original).toContain("200,000")
    expect(content.action).toBe("Buy now")
    expect(content.photos).toEqual(["https://images.example/coat.jpg"])
  })

  it("say how few are left only when every unit is counted", () => {
    expect(
      getProductCardContent(
        product([priced(1000, false, 1), priced(1000, false, 1)]),
        false,
      ).flag,
    ).toBe("Only 2 left")
    expect(
      getProductCardContent(
        product([priced(1000, false, 1), priced(1000)]),
        false,
      ).flag,
    ).toBeNull()
  })

  it("call new products new, and offer a notification for unavailable ones", () => {
    expect(getProductCardContent(product([priced(1000)]), true).flag).toBe(
      "New in",
    )
    const soon = getProductCardContent(
      product([priced(1000)], { coming_soon: true }),
      true,
    )
    expect(soon).toMatchObject({ flag: "Coming soon", action: "Get notified" })
    const gone = getProductCardContent(product([priced(1000, false, 0)]), false)
    expect(gone).toMatchObject({ flag: "Sold out", action: "Get notified" })
  })

  it("find where a collection's prices start", () => {
    expect(
      lowestPrice([product([priced(90000)]), product([priced(45000)])]),
    ).toContain("45,000")
    expect(lowestPrice([])).toBeNull()
    expect(pieces(1)).toBe("1 piece")
    expect(pieces(24)).toBe("24 pieces")
  })
})
