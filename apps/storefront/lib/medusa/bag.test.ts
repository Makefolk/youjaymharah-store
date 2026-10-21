import { describe, expect, it } from "vitest"

import { formatVariantTitle, getBagSummary, getLinePrice } from "./bag"

describe("getLinePrice", () => {
  it("multiplies by quantity and keeps the sale's original price", () => {
    expect(
      getLinePrice({
        unit_price: 150,
        quantity: 2,
        compare_at_unit_price: 200,
      }),
    ).toEqual({ total: 300, compareAt: 400 })
    expect(
      getLinePrice({
        unit_price: 150,
        quantity: 1,
        compare_at_unit_price: undefined,
      }),
    ).toEqual({ total: 150, compareAt: null })
  })
})

describe("getBagSummary", () => {
  it("counts items and uses the cart's totals", () => {
    expect(
      getBagSummary({
        items: [
          { unit_price: 100, quantity: 2 },
          { unit_price: 50, quantity: 1 },
        ] as never,
        item_subtotal: 250,
        discount_total: 25,
        total: 225,
      } as never),
    ).toEqual({ count: 3, subtotal: 250, discount: 25, total: 225 })
  })
})

it("reads variant titles the way the product page does", () => {
  expect(formatVariantTitle("Black / M")).toBe("Black · M")
  expect(formatVariantTitle("Default variant")).toBe("")
})
