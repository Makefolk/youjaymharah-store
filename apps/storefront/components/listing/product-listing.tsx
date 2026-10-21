"use client"

import { ArrowUpIcon, SlidersHorizontalIcon } from "@phosphor-icons/react"
import { useInfiniteQuery } from "@tanstack/react-query"
import Link from "next/link"
import { useQueryStates } from "nuqs"
import { useEffect, useMemo, useState } from "react"

import { ProductCard } from "@/components/catalog/product-card"
import { listingQueries } from "@/features/listing/queries"
import { useListingLayout } from "@/features/listing/use-listing-layout"
import {
  activeLayout,
  countActiveFilters,
  DEFAULT_LAYOUT_GRID,
  emptyListingState,
  facetValueLabel,
  LAYOUTS,
  listingParsers,
  type LayoutIndex,
  type ListingFacet,
  type ListingScope,
  type ListingSortOption,
  type ListingState,
} from "@/lib/medusa/listing"
import { cn } from "@/lib/util/cn"

import { FilterSheet } from "./filter-sheet"

export type ListingTab = { label: string; href: string; active: boolean }

/**
 * A product listing: tabs to neighbouring categories, "Filter & sort", three
 * grid layouts, and "Load more". Filters and sort live in the URL, so a
 * filtered page can be shared and the back button undoes a change.
 */
export function ProductListing({
  title,
  scope,
  defaultSort,
  regionId,
  newBadgeDays,
  tabs = [],
}: {
  title: string
  scope: ListingScope
  defaultSort: ListingSortOption
  regionId: string
  newBadgeDays: number
  tabs?: ListingTab[]
}) {
  const [params, setParams] = useQueryStates(listingParsers, {
    history: "push",
    scroll: false,
  })
  const state = useMemo<ListingState>(
    () => ({ ...emptyListingState(), ...params }),
    [params],
  )
  const args = useMemo(
    () => ({ scope, state, regionId, defaultSort }),
    [scope, state, regionId, defaultSort],
  )

  const results = useInfiniteQuery(listingQueries.results(args))
  const pages = results.data?.pages ?? []
  const products = pages.flatMap((page) => page.products)
  const count = pages[0]?.count ?? 0
  const facets = pages[0]?.facets

  const [layout, setLayout] = useListingLayout()
  const [sheetOpen, setSheetOpen] = useState(false)
  const filtersInUse = countActiveFilters(state)
  const grid = layout === null ? DEFAULT_LAYOUT_GRID : LAYOUTS[layout].grid
  const details = layout === null || LAYOUTS[layout].details

  const apply = (next: ListingState) => void setParams(next)

  return (
    <div>
      <h1 className="px-5 text-center text-2xl font-medium tracking-[-0.01em] sm:px-6">
        {title}
      </h1>

      {tabs.length > 1 && (
        <nav
          aria-label={`${title} categories`}
          className="mt-6 [scrollbar-width:none] overflow-x-auto md:mt-8"
        >
          <ul className="flex w-max gap-6 px-5 text-[13px] font-medium sm:px-6 md:mx-auto lg:px-12">
            {tabs.map((tab) => (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={tab.active ? "page" : undefined}
                  className={cn(
                    "block border-b py-2 whitespace-nowrap transition-colors",
                    tab.active
                      ? "border-foreground text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <div className="mt-4 flex items-center justify-between gap-4 px-5 py-3 sm:px-6 md:mt-6 lg:px-12">
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex items-center gap-2.5 text-[13px] hover:text-muted-foreground"
        >
          <SlidersHorizontalIcon className="size-5" />
          Filter &amp; sort
          {filtersInUse > 0 && (
            <span className="text-muted-foreground">({filtersInUse})</span>
          )}
        </button>
        <div className="flex items-center gap-4">
          <p className="text-[13px] text-muted-foreground tabular-nums max-sm:hidden">
            {results.isPending
              ? ""
              : `${count} ${count === 1 ? "product" : "products"}`}
          </p>
          <LayoutToggles layout={layout} onChange={setLayout} />
        </div>
      </div>

      {filtersInUse > 0 && (
        <div className="flex flex-wrap items-center gap-2 px-5 pb-3 sm:px-6 lg:px-12">
          {(Object.keys(state) as (keyof ListingState)[])
            .filter((key) => key !== "sort")
            .flatMap((facet) =>
              (state[facet] as string[]).map((value) => (
                <button
                  key={`${facet}:${value}`}
                  type="button"
                  onClick={() =>
                    apply({
                      ...state,
                      [facet]: (state[facet] as string[]).filter(
                        (entry) => entry !== value,
                      ),
                    })
                  }
                  className="flex items-center gap-1.5 border border-border px-2.5 py-1 text-[12px] hover:border-foreground"
                  aria-label={`Remove filter ${value}`}
                >
                  {facetValueLabel(facet as ListingFacet, value)}{" "}
                  <span aria-hidden>×</span>
                </button>
              )),
            )}
          <button
            type="button"
            onClick={() => apply({ ...emptyListingState(), sort: state.sort })}
            className="text-[12px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
          >
            Clear all
          </button>
        </div>
      )}

      {results.isPending ? (
        <ul className={cn("grid", grid)} aria-busy>
          {Array.from({ length: 8 }, (_, index) => (
            <li key={index} className="aspect-3/4 animate-pulse bg-muted" />
          ))}
        </ul>
      ) : results.isError ? (
        <p className="px-5 py-16 text-center text-[15px] text-muted-foreground">
          We couldn&apos;t load these products.{" "}
          <button
            type="button"
            onClick={() => void results.refetch()}
            className="underline underline-offset-4"
          >
            Try again
          </button>
        </p>
      ) : products.length === 0 ? (
        <div className="px-5 py-16 text-center text-[15px] text-muted-foreground">
          <p>Nothing matches these filters.</p>
          {filtersInUse > 0 && (
            <button
              type="button"
              onClick={() =>
                apply({ ...emptyListingState(), sort: state.sort })
              }
              className="mt-3 text-foreground underline underline-offset-4"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <ul
          className={cn(
            "grid transition-opacity",
            grid,
            results.isPlaceholderData && "opacity-50",
          )}
        >
          {products.map((product, index) => (
            <li key={product.id} className="min-w-0">
              <ProductCard
                product={product}
                newBadgeDays={newBadgeDays}
                inset
                priority={index < 4}
                showDetails={details}
                showBadges={details}
                showWishlist={details}
                showCarouselArrows={details}
                showCarouselDots={details}
                showColourSelector={details}
                sizes={
                  layout === 2
                    ? "(min-width: 1024px) 10vw, (min-width: 768px) 17vw, 33vw"
                    : layout === 1
                      ? "(min-width: 1024px) 17vw, (min-width: 768px) 25vw, 50vw"
                      : "(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 100vw"
                }
              />
            </li>
          ))}
        </ul>
      )}

      {products.length > 0 && (
        <LoadMore
          shown={products.length}
          total={count}
          loading={results.isFetchingNextPage}
          onLoad={() => void results.fetchNextPage()}
        />
      )}

      <BackToTop />

      <FilterSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        args={args}
        facets={facets}
        onApply={apply}
      />
    </div>
  )
}

function GridIcon({ columns }: { columns: number }) {
  const rows = columns >= 3 ? 3 : 2
  return (
    <svg viewBox="0 0 18 18" aria-hidden className="size-4.5 fill-current">
      {Array.from({ length: columns * rows }, (_, index) => {
        const gap = 1.5
        const width = (18 - gap * (columns - 1)) / columns
        const height = (18 - gap * (rows - 1)) / rows
        const x = (index % columns) * (width + gap)
        const y = Math.floor(index / columns) * (height + gap)
        return <rect key={index} x={x} y={y} width={width} height={height} />
      })}
    </svg>
  )
}

/** Phones and desktops each show their own three choices. */
function LayoutToggles({
  layout,
  onChange,
}: {
  layout: LayoutIndex | null
  onChange: (layout: LayoutIndex) => void
}) {
  const group = (breakpoint: "mobile" | "desktop") => {
    const active = activeLayout(layout, breakpoint)
    return (
      <div
        role="radiogroup"
        aria-label="Layout"
        className={cn(
          "flex items-center gap-1",
          breakpoint === "mobile" ? "lg:hidden" : "max-lg:hidden",
        )}
      >
        {LAYOUTS.map((option, index) => {
          const columns =
            breakpoint === "mobile"
              ? option.mobileColumns
              : option.desktopColumns
          return (
            <button
              key={index}
              type="button"
              role="radio"
              aria-checked={active === index}
              aria-label={`${columns} ${columns === 1 ? "column" : "columns"}${option.details ? "" : ", photos only"}`}
              title={`${columns} ${columns === 1 ? "column" : "columns"}`}
              onClick={() => onChange(index as LayoutIndex)}
              className={cn(
                "flex size-9 items-center justify-center border-b transition-colors",
                active === index
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              )}
            >
              <GridIcon
                columns={
                  (breakpoint === "mobile" ? [1, 2, 3] : [2, 3, 4])[index]
                }
              />
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <>
      {group("mobile")}
      {group("desktop")}
    </>
  )
}

function LoadMore({
  shown,
  total,
  loading,
  onLoad,
}: {
  shown: number
  total: number
  loading: boolean
  onLoad: () => void
}) {
  const progress = total ? Math.min(100, (shown / total) * 100) : 100
  return (
    <div className="mx-auto mt-14 flex max-w-md flex-col items-center gap-3 px-5">
      <p className="text-[13px] text-muted-foreground tabular-nums">
        Showing {shown} of {total}
      </p>
      <div className="h-px w-full bg-border" aria-hidden>
        <div
          className="h-px bg-foreground transition-[width] duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>
      {shown < total && (
        <button
          type="button"
          onClick={onLoad}
          disabled={loading}
          aria-busy={loading || undefined}
          className="mt-3 h-12 w-full border border-foreground text-[12px] font-medium tracking-[0.06em] uppercase transition-colors hover:bg-foreground hover:text-background disabled:cursor-wait disabled:opacity-60"
        >
          {loading ? "Loading…" : `Load more products (${shown}/${total})`}
        </button>
      )}
    </div>
  )
}

function BackToTop() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      setVisible(window.scrollY > window.innerHeight * 1.5)
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    window.addEventListener("scroll", schedule, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule)
    }
  }, [])

  return (
    <button
      type="button"
      inert={!visible}
      aria-label="Back to top"
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className={cn(
        "fixed right-4 bottom-4 z-30 flex size-11 items-center justify-center border border-border bg-background/95 backdrop-blur transition-[opacity,translate] duration-300 hover:border-foreground",
        visible ? "opacity-100" : "pointer-events-none translate-y-2 opacity-0",
      )}
    >
      <ArrowUpIcon className="size-4" />
    </button>
  )
}
