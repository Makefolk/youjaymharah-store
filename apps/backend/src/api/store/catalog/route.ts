import type {
  MedusaResponse,
  MedusaStoreRequest,
} from "@medusajs/framework/http";
import type {
  ICachingModuleService,
  SearchTypes,
} from "@medusajs/framework/types";
import { MedusaError, Modules, ProductStatus } from "@medusajs/framework/utils";

import type { StoreCatalogQueryType } from "../../middlewares";
import { recordSearchTerm } from "../../../lib/record-search-term";
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

/** Matches beyond this aren't worth paging through; refine the search. */
const SEARCH_MATCH_LIMIT = 500;

async function cached<T>(
  req: MedusaStoreRequest<unknown, StoreCatalogQueryType>,
  key: string,
  load: () => Promise<T>,
): Promise<T> {
  const cache: ICachingModuleService = req.scope.resolve(Modules.CACHING);
  try {
    const hit = (await cache.get({ key })) as T | null;
    if (hit) return hit;
  } catch {
    // A cache outage only costs speed.
  }
  const value = await load();
  try {
    await cache.set({
      key,
      data: value as object,
      ttl: LISTING_CACHE_SECONDS,
      tags: ["catalog-listing"],
    });
  } catch {
    // As above.
  }
  return value;
}

/**
 * The ids matching a search term in relevance order, from the Search Module,
 * which also tolerates typos. Narrowed to the listing's category or
 * collection when there is one.
 */
async function searchIds(
  req: MedusaStoreRequest<unknown, StoreCatalogQueryType>,
  q: string,
  scope: ListingScope,
): Promise<string[]> {
  const salesChannelIds = req.publishable_key_context.sales_channel_ids;
  const key = `catalog-search:${JSON.stringify([
    q.toLowerCase(),
    scope.category ?? null,
    scope.collection ?? null,
    [...salesChannelIds].sort(),
  ])}`;

  return cached(req, key, async () => {
    const searchModule = req.scope.resolve(Modules.SEARCH, {
      allowUnregistered: true,
    });
    if (!searchModule) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Product search is unavailable: the Search Module is not configured.",
      );
    }
    const filters: SearchTypes.SearchFilters = {
      status: ProductStatus.PUBLISHED,
      sales_channel_ids: { $in: salesChannelIds },
      q,
      ...(scope.category
        ? { category_handles: { $in: [scope.category] } }
        : {}),
      ...(scope.collection
        ? { collection_handle: { $in: [scope.collection] } }
        : {}),
    };
    const result = await searchModule.search({
      entity: "product",
      fields: ["id"],
      filters,
      pagination: { skip: 0, take: SEARCH_MATCH_LIMIT },
      search_options: { typo_tolerance: true },
    });
    return result.hits.map((hit) => String(hit.document.id));
  });
}

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
  return cached(req, key, () =>
    loadListingProducts(req.scope, { scope, regionId, salesChannelIds }),
  );
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
  const { q, category, collection, sort, offset, limit, region_id, ...rest } =
    req.validatedQuery;
  const scope = { category, collection };

  const [products, matches] = await Promise.all([
    listingProducts(req, scope, region_id),
    q ? searchIds(req, q, scope) : Promise.resolve(null),
  ]);

  const filters = Object.fromEntries(
    FACETS.map((facet) => [facet, rest[facet] ?? []]),
  );
  const rank = matches
    ? new Map(matches.map((id, index) => [id, index]))
    : undefined;
  const result = listCatalog(
    rank ? products.filter((product) => rank.has(product.id)) : products,
    { filters, sort, offset, limit, rank },
  );

  // Once per search: not again for each filter, sort or "Load more".
  const refined =
    offset > 0 ||
    sort !== "recommended" ||
    FACETS.some((facet) => rest[facet]?.length);
  if (q && !refined) await recordSearchTerm(req.scope, q, result.count);

  res.json({ ...result, offset, limit });
};
