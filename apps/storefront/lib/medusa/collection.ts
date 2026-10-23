import type { HttpTypes } from "@medusajs/types"

import { metaImage, metaText } from "./metadata"

export function hasCollectionPage(collection: { handle?: string | null }) {
  return Boolean(collection.handle?.trim())
}

export function isCollectionLinkAvailable(
  href: string,
  collections: readonly { handle?: string | null }[],
  storefrontUrl: string,
) {
  try {
    const origin = new URL(storefrontUrl)
    const destination = new URL(href, origin)
    const path = destination.pathname.replace(/\/+$/, "")
    if (
      destination.origin !== origin.origin ||
      (path !== "/collections" && !path.startsWith("/collections/"))
    )
      return true

    const available = collections.filter(hasCollectionPage)
    if (path === "/collections") return available.length > 0
    const handle = decodeURIComponent(path.slice("/collections/".length))
    return available.some((collection) => collection.handle === handle)
  } catch {
    return false
  }
}

export type CollectionContent = {
  id: string
  title: string
  handle: string
  /** From the collection's Website content box in the admin. */
  description: string | null
  /** Landscape banner. */
  heroImage: string | null
  /** Portrait banner for phones; fall back to `heroImage`, cropped. */
  heroImageMobile: string | null
}

/**
 * A collection's page content, cleaned: empty strings saved by the admin read
 * as null. Needs `+metadata` in `fields`.
 */
export function getCollectionContent(
  collection: Pick<
    HttpTypes.StoreCollection,
    "id" | "title" | "handle" | "metadata"
  >,
): CollectionContent {
  return {
    id: collection.id,
    title: collection.title,
    handle: collection.handle,
    description: metaText(collection.metadata?.description),
    heroImage: metaImage(collection.metadata?.hero_image),
    heroImageMobile: metaImage(collection.metadata?.hero_image_mobile),
  }
}
