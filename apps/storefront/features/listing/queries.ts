import {
  infiniteQueryOptions,
  keepPreviousData,
  queryOptions,
} from "@tanstack/react-query"
import type { StoreCatalogResponse } from "@youjaymharah/api-types"

import { getBrowserSdk } from "@/lib/medusa/browser"
import { catalogQuery } from "@/lib/medusa/listing"
import { queryKeys } from "@/lib/query/keys"

import { fetchListingPage, nextOffset, type ListingArgs } from "./fetch"

export const listingQueries = {
  /** The listing, a page at a time ("Load more"). */
  results: (args: ListingArgs) =>
    infiniteQueryOptions({
      queryKey: queryKeys.listing.results(
        args.scope,
        args.state,
        args.regionId,
        args.defaultSort,
      ),
      queryFn: ({ pageParam }) =>
        fetchListingPage(getBrowserSdk(), args, pageParam),
      initialPageParam: 0,
      getNextPageParam: nextOffset,
      // Keep showing the old results while new filters load.
      placeholderData: keepPreviousData,
    }),

  /**
   * How many products the filter sheet's choices would show, and the counts
   * beside each value, before they're applied.
   */
  preview: (args: ListingArgs) =>
    queryOptions({
      queryKey: queryKeys.listing.count(args.scope, args.state, args.regionId),
      queryFn: () =>
        getBrowserSdk().client.fetch<StoreCatalogResponse>("/store/catalog", {
          query: catalogQuery(args.scope, args.state, {
            regionId: args.regionId,
            defaultSort: args.defaultSort,
            limit: 1,
          }),
        }),
      placeholderData: keepPreviousData,
    }),
}
