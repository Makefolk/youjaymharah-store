import "server-only"

import { ImageResponse } from "next/og"
import type { ReactElement } from "react"

import type { StorefrontSettings } from "@/lib/medusa/storefront-settings"
import { getBaseURL } from "@/lib/util/env"

import { loadFonts } from "./assets"
import { CardPanel, OG_SIZE } from "./cards"

/**
 * Platforms cache previews themselves; this keeps a burst of shares from
 * redrawing the card each time, and lets a changed product show within the
 * hour (its URL also changes when the product is edited).
 */
const CACHE_CONTROL =
  "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400"

export async function renderCard(card: ReactElement) {
  return new ImageResponse(card, {
    ...OG_SIZE,
    fonts: await loadFonts(),
    headers: { "cache-control": CACHE_CONTROL },
  })
}

/** The address shown on cards: example.com, without the scheme. */
export const siteHost = () => new URL(getBaseURL()).host

/** For a link to something that no longer exists: the store itself. */
export function brandCard(settings: StorefrontSettings) {
  return renderCard(
    <CardPanel
      width={OG_SIZE.width}
      brand={settings.brand.name}
      site={siteHost()}
      title={settings.seo.title || settings.brand.name}
      details={settings.seo.description}
      action="Shop now"
    />,
  )
}
