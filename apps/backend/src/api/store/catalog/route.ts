import type {
  MedusaResponse,
  MedusaStoreRequest,
} from "@medusajs/framework/http";
import type { ICachingModuleService } from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";

import type { StoreCatalogQueryType } from "../../middlewares";
import {
  FACETS,
  listCatalog,
  type ListingProduct,
} from "../../../lib/catalog-listing";
import {
  loadListingProducts,
  type ListingScope,
} from "../../../workflows/utils/catalog-products";

/**
 * Seconds a listing's products are reused across requests, so changing a
 * filter, the sort or the page doesn't reload the catalogue. Prices and stock
 * catch up within this long.
 */
const LISTING_CACHE_SECONDS = 60;

async function listingProducts(
  req: MedusaStoreRequest<unknown, StoreCatalogQueryType>,
  scope: ListingScope,
  regionId: string,
): Promise<ListingProduct[]> {
  const salesChannelIds = req.publishable_key_context.sales_channel_ids;
  const key = `catalog-listing:${JSON.stringify([
    scope.category ?? null,
    scope.collection ?? null,
    regionId,
    [...salesChannelIds].sort(),
  ])}`;
  const cache: ICachingModuleService = req.scope.resolve(Modules.CACHING);

  try {
    const cached = (await cache.get({ key })) as ListingProduct[] | null;
    if (cached) return cached;
  } catch {
    // A cache outage only costs speed.
  }

  const products = await loadListingProducts(req.scope, {
    scope,
    regionId,
    salesChannelIds,
  });

  try {
    await cache.set({
      key,
      data: products,
      ttl: LISTING_CACHE_SECONDS,
      tags: ["catalog-listing"],
    });
  } catch {
    // As above.
  }

  return products;
}

/**
 * A listing page's products in order, with the total and how many products
 * each filter value would show. Returns ids only: load the cards from
 * /store/products with the same region, which keeps prices, photos and stock
 * exactly as product cards elsewhere show them.
 */
export const GET = async (
  req: MedusaStoreRequest<unknown, StoreCatalogQueryType>,
  res: MedusaResponse,
) => {
  const { category, collection, sort, offset, limit, region_id, ...rest } =
    req.validatedQuery;

  const products = await listingProducts(
    req,
    { category, collection },
    region_id,
  );

  const filters = Object.fromEntries(
    FACETS.map((facet) => [facet, rest[facet] ?? []]),
  );

  res.json({
    ...listCatalog(products, { filters, sort, offset, limit }),
    offset,
    limit,
  });
};
