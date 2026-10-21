import type { HttpTypes } from "@medusajs/types"
import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it, vi } from "vitest"

import { ProductCard, type ProductCardProps } from "./product-card"

vi.mock("./product-card-controls", () => ({
  ProductCardControls: ({
    showWishlist,
    showNotifyMe,
  }: {
    showWishlist: boolean
    showNotifyMe: boolean
  }) =>
    createElement(
      "div",
      null,
      showWishlist && createElement("button", null, "Wishlist control"),
      showNotifyMe && createElement("button", null, "Notify control"),
    ),
}))

function product(variants: Record<string, unknown>[], metadata = {}) {
  return {
    id: "product_coat",
    title: "Wool coat",
    handle: "wool-coat",
    created_at: new Date().toISOString(),
    metadata,
    variants,
  } as unknown as HttpTypes.StoreProduct
}

function render(
  value: HttpTypes.StoreProduct,
  props: Partial<ProductCardProps> = {},
) {
  return renderToStaticMarkup(
    createElement(ProductCard, {
      product: value,
      newBadgeDays: 30,
      showNotifyMe: true,
      badgePlacement: "image",
      ...props,
    }),
  )
}

describe("product card merchandising", () => {
  it("offers launch notifications and suppresses New for coming-soon products", () => {
    const html = render(
      product([{ manage_inventory: false }], { coming_soon: true }),
    )
    expect(html).toContain("Coming soon")
    expect(html).toContain("Notify control")
    expect(html).not.toContain(">New<")
  })

  it("only offers restock notifications when every variant is known to be sold out", () => {
    const soldOut = {
      manage_inventory: true,
      inventory_quantity: 0,
      allow_backorder: false,
    }
    expect(render(product([soldOut]))).toContain("Notify control")
    for (const other of [
      { ...soldOut, inventory_quantity: 1 },
      { ...soldOut, allow_backorder: true },
      { manage_inventory: false },
      { manage_inventory: true },
    ]) {
      const html = render(product([soldOut, other]))
      expect(html).not.toContain("Sold out")
      expect(html).not.toContain("Notify control")
    }
  })

  it("shows the sale percentage only for the displayed variant's sale price list", () => {
    const variant = (amount: number, sale: boolean) => ({
      manage_inventory: false,
      calculated_price: {
        calculated_amount: amount,
        original_amount: 150,
        currency_code: "ngn",
        calculated_price: { price_list_type: sale ? "sale" : "override" },
      },
    })
    expect(render(product([variant(100, true)]))).toContain(">−33%<")
    expect(render(product([variant(100, false)]))).not.toContain(">−33%<")
    expect(
      render(product([variant(100, true), variant(50, false)])),
    ).not.toContain(">−33%<")
  })

  it("shows four colour swatches and links the rest as +N", () => {
    const colours = ["Black", "Navy", "Cream", "Red", "Green", "Blue"]
    const html = render({
      ...product(
        colours.map((colour) => ({
          id: colour,
          options: [{ option_id: "colour", value: colour }],
          manage_inventory: false,
        })),
      ),
      options: [{ id: "colour", title: "Colour" }],
    } as unknown as HttpTypes.StoreProduct)
    expect(html.match(/aria-pressed=/g)).toHaveLength(4)
    expect(html).toContain('aria-label="2 more colours of Wool coat"')
    expect(html).toContain(">+2<")
  })

  it("shows one status label on the photo", () => {
    const html = render(product([{ id: "v", manage_inventory: false }]))
    expect(html.match(/>New</g)).toHaveLength(1)
    expect(html).not.toContain("writing-mode")
  })

  it("keeps badges and controls independently configurable", () => {
    const value = product([], { coming_soon: true })
    const html = render(value, { showBadges: false, showWishlist: true })
    expect(html).not.toContain("Coming soon")
    expect(html).toContain("Notify control")
    expect(html).toContain("Wishlist control")
    const hidden = render(value, { showNotifyMe: false, showWishlist: false })
    expect(hidden).not.toContain("<button")
    expect(hidden).toContain("Coming soon")
  })

  it("keeps controls outside the product link and the title accessible in image-only mode", () => {
    const html = render(product([], { coming_soon: true }), {
      showDetails: false,
    })
    expect(html).toMatch(/<h3[^>]*><a[^>]*>Wool coat<\/a><\/h3>/)
    expect(html.indexOf("</a>")).toBeLessThan(html.indexOf("<button"))
  })

  it("renders every photo with first-slide navigation and individually optional controls", () => {
    const value = {
      ...product([]),
      thumbnail: "/cover.jpg",
      images: [
        { id: "cover", url: "/cover.jpg" },
        { id: "back", url: "/back.jpg" },
      ],
    } as HttpTypes.StoreProduct
    const html = render(value)
    expect(html).toContain('aria-label="Next image of Wool coat"')
    expect(html).not.toContain('aria-label="Previous image of Wool coat"')
    expect(html).toContain('aria-label="Show image 2 of 2"')
    expect(html).toContain('aria-current="true"')
    const hidden = render(value, {
      showCarouselArrows: false,
      showCarouselDots: false,
    })
    expect(hidden).not.toContain("Next image of")
    expect(hidden).not.toContain("Show image 2")
    expect(hidden).toContain('aria-roledescription="carousel"')
    expect(hidden.match(/aria-roledescription="slide"/g)).toHaveLength(2)
  })

  it("does not render gallery navigation for a single photo", () => {
    const html = render({ ...product([]), thumbnail: "/cover.jpg" })
    expect(html).not.toContain("Next image of")
    expect(html).not.toContain("Choose an image of")
  })
})
