import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"

import { StorefrontSettingsProvider } from "@/features/site-settings/provider"
import type { StorefrontSettings } from "@/lib/medusa/storefront-settings"

import { BrandLoader } from "./brand-loader"

function render(
  brand: Partial<StorefrontSettings["brand"]>,
  props: Parameters<typeof BrandLoader>[0] = {},
) {
  const settings = {
    brand: { name: "YouJaymharah Trends", logo_url: null, ...brand },
  } as StorefrontSettings
  return renderToStaticMarkup(
    createElement(StorefrontSettingsProvider, {
      settings,
      children: createElement(BrandLoader, props),
    }),
  )
}

describe("brand loader", () => {
  it("shows the logo, contained whatever its shape", () => {
    const html = render({ logo_url: "https://files.example/logo.png" })
    expect(html).toContain("logo.png")
    expect(html).toContain("object-contain")
    expect(html).not.toContain("YouJaymharah Trends")
  })

  it("shows the store name without a logo", () => {
    expect(render({})).toContain("YouJaymharah Trends")
  })

  it("is announced and centred, filling the page or its section", () => {
    const page = render({}, { size: "page", label: "Loading your bag" })
    expect(page).toContain('role="status"')
    expect(page).toContain("Loading your bag")
    expect(page).toContain("items-center justify-center")
    expect(page).toContain("min-h-[70svh]")
    expect(render({})).toContain("min-h-40")
  })
})
