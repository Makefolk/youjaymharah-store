import "server-only"

import type { HttpTypes } from "@medusajs/types"
import type { StoreSearchResponse } from "@youjaymharah/api-types"
import { cache } from "react"

import { sortCategoryTree } from "./category"
import { isNotFound } from "./errors"
import { getStoreRegion } from "./region"
import { sdk } from "./server"

/**
 * Catalogue reads for Server Components: products, categories, collections and
 * search, with the region, the right `fields` and caching built in. None of
 * them read cookies, so pages using them stay cacheable.
 *
 * Each response is cached by Next for a short time and tagged, so a future
 * `/api/revalidate` route can refresh them on demand with `revalidateTag`.
 */

/** Tags on cached catalogue responses, for `revalidateTag`. */
export const CATALOG_TAGS = {
  products: "products",
  product: (handle: string) => `product:${handle}`,
  categories: "categories",
  collections: "collections",
} as const

/** Stock and prices change often; category and collection structure rarely. */
const PRODUCT_REVALIDATE_SECONDS = 60
const TAXONOMY_REVALIDATE_SECONDS = 300

/** What a product card needs: price, sale, stock, swatches and the New badge. */
export const PRODUCT_CARD_FIELDS = [
  "id",
  "title",
  "handle",
  "thumbnail",
  "created_at",
  "+metadata",
  "*options",
  "*variants.calculated_price",
  "+variants.inventory_quantity",
  "+variants.manage_inventory",
  "+variants.allow_backorder",
  "*variants.options",
].join(",")

/** Pass as listProducts' fields when cards render a swipe/variant gallery. */
export const PRODUCT_CARD_MEDIA_FIELDS = [
  PRODUCT_CARD_FIELDS,
  "*images",
  "*variants.images",
  "+variants.thumbnail",
].join(",")

/** Everything a product page needs, including per-colour photos. */
export const PRODUCT_PAGE_FIELDS = [
  PRODUCT_CARD_MEDIA_FIELDS,
  "subtitle",
  "description",
  "material",
  "*categories",
  "*collection",
  "*tags",
].join(",")

const CATEGORY_FIELDS =
  "id,name,handle,description,rank,parent_category_id,+metadata"

// Passing `fields` replaces Medusa's defaults, which is where the parent and
// children relations come from; without these the tree options return flat
// categories.
const CATEGORY_TREE_FIELDS = `${CATEGORY_FIELDS},*category_children`
const CATEGORY_PAGE_FIELDS = `${CATEGORY_TREE_FIELDS},*parent_category`

const COLLECTION_FIELDS = "id,title,handle,+metadata"

function localeHeaders(locale?: string): Record<string, string> | undefined {
  return locale ? { "x-medusa-locale": locale } : undefined
}

/**
 * One product by handle, or null. Wrapped in `React.cache`, so
 * `generateMetadata` and the page share one request.
 */
export const getProductByHandle = cache(
  async (
    handle: string,
    locale?: string,
  ): Promise<HttpTypes.StoreProduct | null> => {
    const region = await getStoreRegion()

    const { products } =
      await sdk.client.fetch<HttpTypes.StoreProductListResponse>(
        "/store/products",
        {
          query: {
            handle,
            region_id: region.id,
            fields: PRODUCT_PAGE_FIELDS,
            limit: 1,
          },
          headers: localeHeaders(locale),
          next: {
            revalidate: PRODUCT_REVALIDATE_SECONDS,
            tags: [CATALOG_TAGS.products, CATALOG_TAGS.product(handle)],
          },
        },
      )

    return products[0] ?? null
  },
)

export type ListProductsParams = {
  categoryId?: string | string[]
  collectionId?: string | string[]
  tagId?: string | string[]
  /** Specific products, for example from search. */
  id?: string[]
  /** Medusa's basic text search; prefer `searchProducts` for a search page. */
  q?: string
  /** Such as `-created_at` for newest first. */
  order?: string
  /** Defaults to 24. */
  limit?: number
  offset?: number
  /** Defaults to PRODUCT_CARD_FIELDS. */
  fields?: string
  /**
   * Any other Store API filter, passed through as-is, such as
   * `{ "variants[options][value]": "Black" }` for a colour filter.
   */
  query?: Record<string, unknown>
  locale?: string
}

export type ProductPage = {
  products: HttpTypes.StoreProduct[]
  count: number
  limit: number
  offset: number
}

/** A page of priced products for a listing grid. */
export async function listProducts(
  params: ListProductsParams = {},
): Promise<ProductPage> {
  const region = await getStoreRegion()
  const limit = params.limit ?? 24
  const offset = params.offset ?? 0

  const response = await sdk.client.fetch<HttpTypes.StoreProductListResponse>(
    "/store/products",
    {
      query: {
        ...params.query,
        region_id: region.id,
        fields: params.fields ?? PRODUCT_CARD_FIELDS,
        limit,
        offset,
        ...(params.categoryId ? { category_id: params.categoryId } : {}),
        ...(params.collectionId ? { collection_id: params.collectionId } : {}),
        ...(params.tagId ? { tag_id: params.tagId } : {}),
        ...(params.id ? { id: params.id } : {}),
        ...(params.q ? { q: params.q } : {}),
        ...(params.order ? { order: params.order } : {}),
      },
      headers: localeHeaders(params.locale),
      next: {
        revalidate: PRODUCT_REVALIDATE_SECONDS,
        tags: [CATALOG_TAGS.products],
      },
    },
  )

  return {
    products: response.products,
    count: response.count,
    limit,
    offset,
  }
}

/**
 * The New arrivals page: newest products first, with card fields. The New
 * badge itself comes from `isNew()`; this only orders the list.
 */
export function listNewArrivals(
  params: Omit<ListProductsParams, "order"> = {},
): Promise<ProductPage> {
  return listProducts({ ...params, order: "-created_at" })
}

/**
 * The whole category tree from the top level down, children in the admin's
 * order. Fetched once and cached; use it for navigation menus and category
 * sections.
 */
export const getCategoryTree = cache(
  async (locale?: string): Promise<HttpTypes.StoreProductCategory[]> => {
    const { product_categories } =
      await sdk.client.fetch<HttpTypes.StoreProductCategoryListResponse>(
        "/store/product-categories",
        {
          query: {
            fields: CATEGORY_TREE_FIELDS,
            include_descendants_tree: true,
            limit: 1000,
          },
          headers: localeHeaders(locale),
          next: {
            revalidate: TAXONOMY_REVALIDATE_SECONDS,
            tags: [CATALOG_TAGS.categories],
          },
        },
      )

    // Every category comes back with its subtree; the tree starts from the
    // ones without a parent.
    return sortCategoryTree(
      product_categories.filter((category) => !category.parent_category_id),
    )
  },
)

/**
 * One category by handle with its parents (for `getCategoryTrail`) and
 * children, or null. Needs no second request for breadcrumbs.
 */
export const getCategoryByHandle = cache(
  async (
    handle: string,
    locale?: string,
  ): Promise<HttpTypes.StoreProductCategory | null> => {
    const { product_categories } =
      await sdk.client.fetch<HttpTypes.StoreProductCategoryListResponse>(
        "/store/product-categories",
        {
          query: {
            handle,
            fields: CATEGORY_PAGE_FIELDS,
            include_ancestors_tree: true,
            include_descendants_tree: true,
            limit: 1,
          },
          headers: localeHeaders(locale),
          next: {
            revalidate: TAXONOMY_REVALIDATE_SECONDS,
            tags: [CATALOG_TAGS.categories],
          },
        },
      )

    const [category] = product_categories

    return category ? sortCategoryTree([category])[0] : null
  },
)

/**
 * Every collection. The header's main nav renders these; build each link with
 * `collectionPath` from `lib/seo/routes`.
 */
export const listCollections = cache(
  async (locale?: string): Promise<HttpTypes.StoreCollection[]> => {
    const { collections } =
      await sdk.client.fetch<HttpTypes.StoreCollectionListResponse>(
        "/store/collections",
        {
          query: { fields: COLLECTION_FIELDS, limit: 100 },
          headers: localeHeaders(locale),
          next: {
            revalidate: TAXONOMY_REVALIDATE_SECONDS,
            tags: [CATALOG_TAGS.collections],
          },
        },
      )

    return collections
  },
)

/** One collection by handle, or null. Pass it to `getCollectionContent`. */
export const getCollectionByHandle = cache(
  async (
    handle: string,
    locale?: string,
  ): Promise<HttpTypes.StoreCollection | null> => {
    const { collections } =
      await sdk.client.fetch<HttpTypes.StoreCollectionListResponse>(
        "/store/collections",
        {
          query: { handle, fields: COLLECTION_FIELDS, limit: 1 },
          headers: localeHeaders(locale),
          next: {
            revalidate: TAXONOMY_REVALIDATE_SECONDS,
            tags: [CATALOG_TAGS.collections],
          },
        },
      )

    return collections[0] ?? null
  },
)

/**
 * One collection by id, or null when it doesn't exist. For the home page's
 * featured collection (`settings.homepage.featured_collection_id`).
 */
export const getCollectionById = cache(
  async (
    id: string,
    locale?: string,
  ): Promise<HttpTypes.StoreCollection | null> => {
    try {
      const { collection } =
        await sdk.client.fetch<HttpTypes.StoreCollectionResponse>(
          `/store/collections/${encodeURIComponent(id)}`,
          {
            query: { fields: COLLECTION_FIELDS },
            headers: localeHeaders(locale),
            next: {
              revalidate: TAXONOMY_REVALIDATE_SECONDS,
              tags: [CATALOG_TAGS.collections],
            },
          },
        )

      return collection
    } catch (error) {
      if (isNotFound(error)) {
        return null
      }

      throw error
    }
  },
)

export type SearchProductsParams = {
  q: string
  /** Handles; several values of one filter match any of them. */
  category?: string[]
  collection?: string[]
  type?: string[]
  tag?: string[]
  /** Up to 50; defaults to 24. */
  limit?: number
  offset?: number
  locale?: string
}

export type SearchResults = {
  /** Priced products, in relevance order. */
  products: HttpTypes.StoreProduct[]
  count: number
  limit: number
  offset: number
  /** Counts per facet value, for refinement filters. */
  facets: StoreSearchResponse["facets"]
}

/**
 * Search, with prices. The search index holds no prices (they depend on the
 * region and sale price lists), so this searches first, then loads the hits
 * as priced products in one more request, keeping the relevance order.
 */
export async function searchProducts(
  params: SearchProductsParams,
): Promise<SearchResults> {
  const limit = params.limit ?? 24
  const offset = params.offset ?? 0

  const search = await sdk.client.fetch<StoreSearchResponse>("/store/search", {
    query: {
      q: params.q,
      limit,
      offset,
      ...(params.category?.length ? { category: params.category } : {}),
      ...(params.collection?.length ? { collection: params.collection } : {}),
      ...(params.type?.length ? { type: params.type } : {}),
      ...(params.tag?.length ? { tag: params.tag } : {}),
    },
    headers: localeHeaders(params.locale),
    next: {
      revalidate: PRODUCT_REVALIDATE_SECONDS,
      tags: [CATALOG_TAGS.products],
    },
  })

  const ids = search.products.map((hit) => hit.id)

  if (!ids.length) {
    return {
      products: [],
      count: search.count,
      limit,
      offset,
      facets: search.facets,
    }
  }

  const { products } = await listProducts({
    id: ids,
    limit: ids.length,
    locale: params.locale,
  })
  const byId = new Map(products.map((product) => [product.id, product]))

  return {
    products: ids
      .map((id) => byId.get(id))
      .filter((product): product is HttpTypes.StoreProduct => Boolean(product)),
    count: search.count,
    limit,
    offset,
    facets: search.facets,
  }
}
