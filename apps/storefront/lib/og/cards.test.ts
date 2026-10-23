import { readFileSync, writeFileSync } from "node:fs"
import { join } from "node:path"

import { ImageResponse } from "next/og"
import { createElement } from "react"
import { describe, expect, it } from "vitest"

import { Card, CardPanel, fit, OG_SIZE, PhotoMosaic, PriceLine } from "./cards"

const font = (file: string) =>
  readFileSync(join(__dirname, "../../assets/fonts", file))
const fonts = [
  {
    name: "Bodoni",
    data: font("BodoniModa-Regular.ttf"),
    weight: 400 as const,
  },
  {
    name: "Sans",
    data: font("InstrumentSans-Regular.ttf"),
    weight: 400 as const,
  },
  {
    name: "Sans",
    data: font("InstrumentSans-Medium.ttf"),
    weight: 500 as const,
  },
  { name: "Naira", data: font("NotoSans-Naira-400.ttf"), weight: 400 as const },
  { name: "Naira", data: font("NotoSans-Naira-500.ttf"), weight: 500 as const },
]

/**
 * A 1×1 PNG, standing in for a product photo; OG_SAMPLE_PHOTO=/a/photo.jpg
 * uses a real one instead.
 */
const PHOTO = process.env.OG_SAMPLE_PHOTO
  ? `data:image/jpeg;base64,${readFileSync(process.env.OG_SAMPLE_PHOTO).toString("base64")}`
  : "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=="

async function render(name: string, card: ReturnType<typeof createElement>) {
  const response = new ImageResponse(card, { ...OG_SIZE, fonts })
  const bytes = Buffer.from(await response.arrayBuffer())
  // OG_PREVIEW_DIR=/some/dir writes the cards out to look at.
  if (process.env.OG_PREVIEW_DIR) {
    writeFileSync(join(process.env.OG_PREVIEW_DIR, `${name}.png`), bytes)
  }
  return bytes
}

const panel = (props: Partial<Parameters<typeof CardPanel>[0]>) =>
  createElement(CardPanel, {
    width: 696,
    brand: "YouJaymharah Trends",
    site: "youjaymharah.com",
    title: "Double-Faced Wool Coat",
    action: "Buy now",
    ...props,
  })

describe("link preview cards", () => {
  it("draw a product on sale, with its photo, price and call to action", async () => {
    const bytes = await render(
      "product",
      createElement(Card, {
        photos: createElement(PhotoMosaic, { photos: [PHOTO], width: 504 }),
        panel: panel({
          flag: "On sale",
          price: createElement(PriceLine, {
            amount: "₦157,500",
            original: "₦225,000",
            percentOff: 30,
          }),
          details: "3 colours · Sizes S–XL",
        }),
      }),
    )
    expect(bytes.subarray(1, 4).toString()).toBe("PNG")
  })

  it("draw a collection or search with several photos", async () => {
    const bytes = await render(
      "collection",
      createElement(Card, {
        photos: createElement(PhotoMosaic, {
          photos: [PHOTO, PHOTO, PHOTO, PHOTO],
          width: 600,
        }),
        panel: panel({
          width: 600,
          flag: "24 pieces",
          title: "The Autumn Edit",
          price: createElement(PriceLine, { amount: "₦45,000", from: true }),
          details: fit(
            "Tailored wool, soft knits and the coats to wear over them, for the cooler months ahead.",
            90,
          ),
          action: "Shop the collection",
        }),
      }),
    )
    expect(bytes.subarray(1, 4).toString()).toBe("PNG")
  })

  it("cuts long text at a word", () => {
    expect(fit("A very long product name indeed", 20)).toBe(
      "A very long product…",
    )
    expect(fit("Short", 20)).toBe("Short")
  })
})
