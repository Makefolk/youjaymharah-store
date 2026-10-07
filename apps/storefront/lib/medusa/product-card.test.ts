import type { HttpTypes } from "@medusajs/types"
import { describe, expect, it } from "vitest"
import {
  getCardColourImage,
  getCardColourProduct,
  getCardGallery,
  getCardStatus,
} from "./product-card"
import { getProductPrice } from "./price"

const product = {
  thumbnail: "/cover.jpg",
  images: [
    { id: "cover", url: "/cover.jpg" },
    { id: "detail", url: "/detail.jpg" },
  ],
  options: [{ id: "colour", title: "Colour" }],
  variants: [
    {
      id: "black-s",
      options: [{ option_id: "colour", value: "Black" }],
      manage_inventory: true,
      inventory_quantity: 0,
      calculated_price: { calculated_amount: 100, currency_code: "ngn" },
    },
    {
      id: "black-m",
      thumbnail: "/black.jpg",
      images: [{ id: "detail", url: "/detail.jpg" }],
      options: [{ option_id: "colour", value: "Black" }],
      manage_inventory: true,
      inventory_quantity: 0,
      calculated_price: { calculated_amount: 120, currency_code: "ngn" },
    },
    {
      id: "cream-s",
      thumbnail: "/cream.jpg",
      images: [{ id: "back", url: "/cream-back.jpg" }],
      options: [{ option_id: "colour", value: "Cream" }],
      manage_inventory: false,
      calculated_price: { calculated_amount: 140, currency_code: "ngn" },
    },
  ],
} as unknown as HttpTypes.StoreProduct

describe("card gallery and colour selection", () => {
  it("includes the product cover, gallery, and all variant media exactly once", () => {
    expect(getCardGallery(product).map((image) => image.url)).toEqual([
      "/cover.jpg",
      "/detail.jpg",
      "/black.jpg",
      "/cream.jpg",
      "/cream-back.jpg",
    ])
    expect(product.images).toHaveLength(2)
  })
  it("finds a colour thumbnail even when the first size has no media", () => {
    expect(getCardColourImage(product, "Black")).toBe("/black.jpg")
    expect(getCardColourImage(product, "Cream")).toBe("/cream.jpg")
  })
  it("falls back to a colour gallery, then the product cover", () => {
    const galleryOnly = {
      ...product,
      variants: (product.variants ?? []).map((v) => ({
        ...v,
        thumbnail: null,
      })),
    }
    expect(getCardColourImage(galleryOnly, "Cream")).toBe("/cream-back.jpg")
    expect(getCardColourImage(product, "Blue")).toBe("/cover.jpg")
    expect(
      getCardGallery({ ...product, thumbnail: null, images: [], variants: [] }),
    ).toEqual([])
  })
  it("updates colour prices and availability without choosing a size or mutating the original product", () => {
    const black = getCardColourProduct(product, "Black")
    expect(black.variants).toHaveLength(2)
    expect(getProductPrice(black)?.price.amount).toBe(100)
    expect(getProductPrice(black)?.isRange).toBe(true)
    expect(getCardStatus(black)).toBe("Sold out")
    expect(getCardStatus(product)).toBeNull()
    expect(getCardColourProduct(product, null)).toBe(product)
    expect(product.variants).toHaveLength(3)
  })
})
