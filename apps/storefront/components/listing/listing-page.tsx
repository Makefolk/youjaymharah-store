import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import Link from "next/link"
import { Suspense, type ReactNode } from "react"

import { listingQueries } from "@/features/listing/queries"
import { fetchListingPageOnServer } from "@/features/listing/server"
import {
  loadListingState,
  type ListingScope,
  type ListingSortOption,
} from "@/lib/medusa/listing"
import { getStoreRegion } from "@/lib/medusa/region"
import { getStorefrontSettings } from "@/lib/medusa/storefront-settings"
import { getQueryClient } from "@/lib/query/client"

import { ProductListing, type ListingTab } from "./product-listing"

/**
 * A listing page's server half: renders the first page on the server (so
 * products show without waiting, and search engines see them), then hands
 * over to ProductListing for filters, layouts and "Load more".
 */
export async function ListingPage({
  title,
  scope,
  defaultSort,
  searchParams,
  breadcrumbs = [],
  tabs,
  hero,
  footer,
  emptyMessage,
}: {
  title: string
  scope: ListingScope
  defaultSort: ListingSortOption
  searchParams: Promise<Record<string, string | string[] | undefined>>
  breadcrumbs?: { name: string; href: string }[]
  tabs?: ListingTab[]
  /** Above everything, e.g. a collection's banner. */
  hero?: ReactNode
  footer?: ReactNode
  emptyMessage?: string
}) {
  const [region, settings, params] = await Promise.all([
    getStoreRegion(),
    getStorefrontSettings(),
    searchParams,
  ])
  const args = {
    scope,
    state: loadListingState(params),
    regionId: region.id,
    defaultSort,
  }
  const queryClient = getQueryClient()
  await queryClient.prefetchInfiniteQuery({
    ...listingQueries.results(args),
    queryFn: ({ pageParam }) => fetchListingPageOnServer(args, pageParam),
  })

  return (
    <main className={hero ? "pb-24" : "pt-6 pb-24 md:pt-10"}>
      {hero}
      {breadcrumbs.length > 0 && (
        <nav
          aria-label="Breadcrumb"
          className="mb-4 px-5 text-[12px] text-muted-foreground sm:px-6 md:text-center lg:px-12"
        >
          <ol className="flex flex-wrap gap-2 md:justify-center">
            {breadcrumbs.map((crumb, index) => (
              <li key={crumb.href} className="flex gap-2">
                {index > 0 && <span aria-hidden>/</span>}
                <Link href={crumb.href} className="hover:text-foreground">
                  {crumb.name}
                </Link>
              </li>
            ))}
          </ol>
        </nav>
      )}
      <HydrationBoundary state={dehydrate(queryClient)}>
        <Suspense>
          <ProductListing
            title={title}
            scope={scope}
            defaultSort={defaultSort}
            regionId={region.id}
            newBadgeDays={settings.products.new_badge_days}
            tabs={tabs}
            emptyMessage={emptyMessage}
          />
        </Suspense>
      </HydrationBoundary>
      {footer}
    </main>
  )
}
