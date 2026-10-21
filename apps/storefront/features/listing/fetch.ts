import type Medusa from "@medusajs/js-sdk"
import type { HttpTypes } from "@medusajs/types"
import type { StoreCatalogResponse } from "@youjaymharah/api-types"

import { PRODUCT_CARD_MEDIA_FIELDS } from "@/lib/medusa/fields"
import {
  catalogQuery,
  type ListingScope,
  type ListingSortOption,
  type ListingState,
} from "@/lib/medusa/listing"

export type ListingPage = StoreCatalogResponse & {
  products: HttpTypes.StoreProduct[]
}

export type ListingArgs = {
  scope: ListingScope
  state: ListingState
  regionId: string
  defaultSort: ListingSortOption
}

/**
 * One page of a listing: the ids in order from /store/catalog, then the
 * cards from /store/products, put back in that order. Takes the SDK so the
 * server render and the browser share it.
 */
export async function fetchListingPage(
  client: Medusa,
  { scope, state, regionId, defaultSort }: ListingArgs,
  offset: number,
  limit?: number,
): Promise<ListingPage> {
  const listing = await client.client.fetch<StoreCatalogResponse>(
    "/store/catalog",
    {
      query: catalogQuery(scope, state, {
        regionId,
        defaultSort,
        offset,
        ...(limit ? { limit } : {}),
      }),
    },
  )

  if (!listing.ids.length) {
    return { ...listing, products: [] }
  }

  const { products } =
    await client.client.fetch<HttpTypes.StoreProductListResponse>(
      "/store/products",
      {
        query: {
          id: listing.ids,
          region_id: regionId,
          fields: PRODUCT_CARD_MEDIA_FIELDS,
          limit: listing.ids.length,
        },
      },
    )
  const byId = new Map(products.map((product) => [product.id, product]))

  return {
    ...listing,
    products: listing.ids
      .map((id) => byId.get(id))
      .filter((product): product is HttpTypes.StoreProduct => Boolean(product)),
  }
}

export function nextOffset(page: ListingPage): number | undefined {
  const next = page.offset + page.ids.length
  return page.ids.length && next < page.count ? next : undefined
}
