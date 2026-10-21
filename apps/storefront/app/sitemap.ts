import type { MetadataRoute } from "next"

import { sdk } from "@/lib/medusa/server"
import { getStorefrontSettings } from "@/lib/medusa/storefront-settings"
import {
  absoluteUrl,
  categoryPath,
  collectionPath,
  CONTACT_PATH,
  DELIVERY_PATH,
  productPath,
  PRODUCTS_PATH,
  RETURNS_POLICY_PATH,
} from "@/lib/seo/routes"

/** Regenerated at most hourly, so new products appear without a deploy. */
export const revalidate = 3600

const PAGE_SIZE = 100

type Listed = { handle: string; updated_at?: string | null }

/** Every item of a Store API list, page by page. */
async function listAll(
  path: string,
  key: string,
  fields: string,
): Promise<Listed[]> {
  const items: Listed[] = []

  for (let offset = 0; ; offset += PAGE_SIZE) {
    const page = await sdk.client.fetch<Record<string, unknown>>(path, {
      query: { limit: PAGE_SIZE, offset, fields },
      next: { revalidate: 3600 },
    })

    const batch = (page[key] as Listed[] | undefined) ?? []
    items.push(...batch)

    if (batch.length < PAGE_SIZE) {
      break
    }
  }

  return items
}

function entries(
  items: Listed[],
  toPath: (handle: string) => string,
  priority: number,
): MetadataRoute.Sitemap {
  return items
    .filter((item) => item.handle)
    .map((item) => ({
      url: absoluteUrl(toPath(item.handle)),
      lastModified: item.updated_at ? new Date(item.updated_at) : undefined,
      priority,
    }))
}

/**
 * sitemap.xml: the home page, and every published product, category and
 * collection the storefront's publishable key can see. Empty while the store
 * is hidden from search engines in the admin.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const settings = await getStorefrontSettings()

  if (!settings.seo.allow_indexing) {
    return []
  }

  const home: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), priority: 1 },
    { url: absoluteUrl(PRODUCTS_PATH), priority: 0.8 },
    ...[CONTACT_PATH, DELIVERY_PATH, RETURNS_POLICY_PATH].map((path) => ({
      url: absoluteUrl(path),
      priority: 0.3,
    })),
  ]

  try {
    const [products, categories, collections] = await Promise.all([
      listAll("/store/products", "products", "handle,updated_at"),
      listAll(
        "/store/product-categories",
        "product_categories",
        "handle,updated_at",
      ),
      listAll("/store/collections", "collections", "handle,updated_at"),
    ])

    return [
      ...home,
      ...entries(categories, categoryPath, 0.8),
      ...entries(collections, collectionPath, 0.7),
      ...entries(products, productPath, 0.6),
    ]
  } catch (error) {
    // The backend is unreachable: publish the home page rather than fail.
    console.error("Sitemap: the catalogue could not be loaded.", error)
    return home
  }
}
