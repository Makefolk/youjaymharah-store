import { describe, expect, it } from "vitest"

import {
  describeMissing,
  getBagCount,
  getProductDetails,
  getPurchaseState,
  getStockMessage,
} from "./product-page"

const option = (id: string, title: string) => ({ id, title })
const variant = (
  id: string,
  colour: string,
  size: string,
  inventory_quantity: number,
) => ({
  id,
  manage_inventory: true,
  allow_backorder: false,
  inventory_quantity,
  options: [
    { value: colour, option_id: "opt_colour" },
    { value: size, option_id: "opt_size" },
  ],
})

const product = (variants: ReturnType<typeof variant>[], metadata = {}) =>
  ({
    metadata,
    options: [option("opt_colour", "Colour"), option("opt_size", "Size")],
    variants,
  }) as never

describe("getPurchaseState", () => {
  const dress = product([
    variant("v_black_s", "Black", "S", 5),
    variant("v_black_m", "Black", "M", 0),
  ])

  it("asks for whatever isn't chosen yet", () => {
    expect(getPurchaseState(dress, { Colour: "Black" }, undefined)).toEqual({
      action: "choose",
      missing: ["Size"],
    })
  })

  it("adds an available variant and offers notify for a sold-out one", () => {
    const [s, m] = (dress as { variants: never[] }).variants
    expect(getPurchaseState(dress, {}, s)).toEqual({
      action: "add",
      stock: "in_stock",
    })
    expect(getPurchaseState(dress, {}, m)).toEqual({
      action: "notify",
      stock: "sold_out",
    })
  })

  it("goes straight to notify when nothing can be bought", () => {
    expect(
      getPurchaseState(product([variant("v", "Black", "S", 0)]), {}, undefined),
    ).toEqual({ action: "notify", stock: "sold_out" })
    expect(
      getPurchaseState(
        product([variant("v", "Black", "S", 5)], { coming_soon: true }),
        {},
        undefined,
      ).action,
    ).toBe("notify")
  })
})

it("words missing options and stock", () => {
  expect(describeMissing(["Size"])).toBe("Choose a size")
  expect(describeMissing(["Colour", "Size"])).toBe("Choose a colour and size")
  expect(getStockMessage("low_stock")).toBe("Only a few left")
  expect(getStockMessage("in_stock")).toBeNull()
})

it("lists material, fit and care when set", () => {
  expect(
    getProductDetails({
      material: "100% linen",
      metadata: { fit: "Relaxed", care: "" },
    } as never),
  ).toEqual([
    { label: "Material", value: "100% linen" },
    { label: "Fit", value: "Relaxed" },
  ])
})

it("counts bag quantities", () => {
  expect(getBagCount({ items: [{ quantity: 2 }, { quantity: 1 }] })).toBe(3)
  expect(getBagCount(null)).toBe(0)
})
