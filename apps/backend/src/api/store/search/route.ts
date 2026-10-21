import type {
  MedusaResponse,
  MedusaStoreRequest,
} from "@medusajs/framework/http";
import type { SearchTypes } from "@medusajs/framework/types";
import { MedusaError, Modules, ProductStatus } from "@medusajs/framework/utils";

import type { StoreSearchProductsType } from "../../middlewares";
import { recordSearchTerm } from "../../../lib/record-search-term";

/**
 * Faceting is off. It was switched off under the earlier in-memory (Orama)
 * provider, which crashed counting a facet across documents missing the key.
 * The Postgres provider computes facets in SQL and does not share that failure,
 * so turning them back on is now a product decision rather than a workaround.
 *
 * Filtering is unaffected. `category`, `type`, `collection` and `tag` below are
 * filters rather than facets, so a results page still narrows by them; what is
 * missing is the counts beside each value.
 */

/**
 * Storefront product search.
 *
 * Returns what the index holds, which is enough to render a results grid.
 * Prices are deliberately absent: they depend on region, currency and any
 * active price list, none of which an index can resolve. Fetch them from
 * `/store/products?id=...` with the shopper's region once the ids are known.
 */
export const GET = async (
  req: MedusaStoreRequest<unknown, StoreSearchProductsType>,
  res: MedusaResponse,
) => {
  const searchModule = req.scope.resolve(Modules.SEARCH, {
    allowUnregistered: true,
  });

  if (!searchModule) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "Product search is unavailable: the Search Module is not configured.",
    );
  }

  const { q, limit, offset, category, type, collection, tag } =
    req.validatedQuery;

  const filters: SearchTypes.SearchFilters = {
    // Drafts and rejected products are indexed too -- the index mirrors the
    // catalogue rather than one audience's view of it -- so a storefront has
    // to say which of them it wants.
    status: ProductStatus.PUBLISHED,
    // Products reach a storefront through a sales channel, and the
    // publishable key decides which. Without this every channel's catalogue
    // would answer every storefront.
    sales_channel_ids: { $in: req.publishable_key_context.sales_channel_ids },
    ...(q ? { q } : {}),
    ...(category?.length ? { category_handles: { $in: category } } : {}),
    ...(type?.length ? { type: { $in: type } } : {}),
    ...(collection?.length ? { collection_handle: { $in: collection } } : {}),
    ...(tag?.length ? { tags: { $in: tag } } : {}),
  };

  const result = await searchModule.search({
    entity: "product",
    // Everything the index can return, so the hits need no second trip to the
    // database to be rendered.
    fields: searchModule.listRetrievableFields("product"),
    filters,
    pagination: { skip: offset, take: limit },
    search_options: {
      // Shoppers type product names from memory, so one typo should still
      // match.
      typo_tolerance: true,
    },
  });

  if (q) {
    await recordSearchTerm(req.scope, q, result.metadata.count ?? 0);
  }

  res.json({
    products: result.hits.map((hit) => hit.document),
    count: result.metadata.count ?? 0,
    offset: result.metadata.skip,
    limit: result.metadata.take,
    facets: result.facets ?? {},
  });
};
