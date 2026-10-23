import type { HttpTypes } from "@medusajs/types"
import type { Metadata } from "next"

import type { StorefrontSettings } from "@/lib/medusa/storefront-settings"
import { getBaseURL } from "@/lib/util/env"

import { productPath } from "./routes"

/** Search results show about this many characters of a description. */
const DESCRIPTION_LIMIT = 155

/** X usernames with the leading @ whether or not staff typed it. */
export function xHandle(value: string | null | undefined): string | undefined {
  if (!value) {
    return undefined
  }

  return value.startsWith("@") ? value : `@${value}`
}

/** Plain text from a product description, cut at a word near `limit`. */
export function summarize(
  html: string | null | undefined,
  limit = DESCRIPTION_LIMIT,
): string | undefined {
  const text = (html ?? "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  if (!text) {
    return undefined
  }

  if (text.length <= limit) {
    return text
  }

  const cut = text.slice(0, limit)
  const lastSpace = cut.lastIndexOf(" ")

  return `${(lastSpace > limit * 0.6 ? cut.slice(0, lastSpace) : cut).trim()}…`
}

function metadataText(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined
}

/**
 * Site-wide defaults for the root layout's `generateMetadata`: the title
 * template, description, favicon, link previews, indexing and Search Console
 * verification. Pages override what they know better.
 */
export function buildRootMetadata(settings: StorefrontSettings): Metadata {
  const { brand, seo } = settings
  const title = seo.title || brand.name
  const description = seo.description ?? undefined
  const image = seo.og_image_url

  return {
    metadataBase: new URL(getBaseURL()),
    applicationName: brand.name,
    title: {
      default: title,
      template: `%s | ${brand.name}`,
    },
    description,
    icons: brand.favicon_url
      ? { icon: brand.favicon_url, apple: brand.favicon_url }
      : undefined,
    openGraph: {
      type: "website",
      siteName: brand.name,
      title,
      description,
      url: "/",
      images: image ? [{ url: image, width: 1200, height: 630 }] : undefined,
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      site: xHandle(seo.twitter_handle),
      title,
      description,
      images: image ? [image] : undefined,
    },
    robots: seo.allow_indexing
      ? { index: true, follow: true }
      : { index: false, follow: false },
    verification: seo.google_site_verification
      ? { google: seo.google_site_verification }
      : undefined,
  }
}

type ProductForMetadata = Pick<
  HttpTypes.StoreProduct,
  "title" | "subtitle" | "description" | "handle" | "thumbnail" | "images"
> & {
  metadata?: Record<string, unknown> | null
  updated_at?: string | Date | null
}

/**
 * The link preview for a page: a generated 1200 × 630 card (app/og) for
 * WhatsApp, Instagram, X, Facebook and iMessage. Next.js replaces the whole
 * `openGraph` and `twitter` objects rather than merging them with the
 * layout's, so the site name and card type are set here too.
 */
export function shareMetadata({
  settings,
  url,
  title,
  description,
  image,
  alt,
}: {
  settings: StorefrontSettings
  url: string
  title: string
  description?: string
  /** The card's address, e.g. `/og/product/wool-coat`. */
  image: string
  alt: string
}): Pick<Metadata, "openGraph" | "twitter"> {
  return {
    openGraph: {
      type: "website",
      siteName: settings.brand.name,
      url,
      title,
      description,
      images: [{ url: image, width: 1200, height: 630, alt }],
    },
    twitter: {
      card: "summary_large_image",
      site: xHandle(settings.seo.twitter_handle),
      title,
      description,
      images: [{ url: image, alt }],
    },
  }
}

/** A version for an image URL, so platforms fetch a fresh card after edits. */
function version(updatedAt: string | Date | null | undefined): string {
  const time = updatedAt ? new Date(updatedAt).getTime() : NaN
  return Number.isFinite(time) ? `?v=${time.toString(36)}` : ""
}

/**
 * A product page's `generateMetadata`. Staff can set `seo_title` and
 * `seo_description` on a product in the admin ("Search & sharing"); otherwise
 * the product's own title, subtitle or description is used. Request
 * `+metadata` for the overrides.
 *
 * Next.js replaces the whole `openGraph` and `twitter` objects rather than
 * merging them with the layout's, so the site name and card type are set
 * again here.
 */
export function buildProductMetadata(
  product: ProductForMetadata,
  settings: StorefrontSettings,
): Metadata {
  const title = metadataText(product.metadata?.seo_title) ?? product.title
  const description =
    metadataText(product.metadata?.seo_description) ??
    summarize(product.subtitle) ??
    summarize(product.description) ??
    settings.seo.description ??
    undefined
  const url = productPath(product.handle)

  return {
    title,
    description,
    alternates: { canonical: url },
    ...shareMetadata({
      settings,
      url,
      title,
      description,
      image: `/og/product/${encodeURIComponent(product.handle)}${version(product.updated_at)}`,
      alt: product.title,
    }),
  }
}
