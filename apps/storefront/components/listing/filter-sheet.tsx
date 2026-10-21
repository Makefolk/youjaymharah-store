"use client"

import {
  ArrowCounterClockwiseIcon,
  CaretRightIcon,
} from "@phosphor-icons/react"
import { useQuery } from "@tanstack/react-query"
import { useEffect, useState } from "react"

import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { listingQueries } from "@/features/listing/queries"
import type { ListingArgs } from "@/features/listing/fetch"
import {
  emptyListingState,
  FACET_LABELS,
  FACETS,
  facetValueLabel,
  SORT_LABELS,
  SORTS,
  type ListingFacet,
  type ListingFacets,
  type ListingState,
} from "@/lib/medusa/listing"
import { cn } from "@/lib/util/cn"

/**
 * "Filter & sort": a panel from the right on larger screens, the whole
 * screen on phones. Choices stay pending until "View N products", which
 * updates live as they change, so nobody applies a filter that empties the
 * page.
 */
export function FilterSheet({
  open,
  onOpenChange,
  args,
  facets,
  onApply,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The listing as currently applied. */
  args: ListingArgs
  facets: ListingFacets | undefined
  onApply: (state: ListingState) => void
}) {
  const [draft, setDraft] = useState<ListingState>(args.state)

  // Start from what's applied each time the sheet opens.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setDraft(args.state)
  }, [open, args.state])

  const preview = useQuery({
    ...listingQueries.preview({ ...args, state: draft }),
    enabled: open,
  })
  const shownFacets = preview.data?.facets ?? facets
  const count = preview.data?.count

  const toggle = (facet: ListingFacet, value: string) =>
    setDraft((current) => ({
      ...current,
      [facet]: current[facet].includes(value)
        ? current[facet].filter((entry) => entry !== value)
        : [...current[facet], value],
    }))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="top-0 right-0 left-auto flex h-dvh w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 p-0 sm:max-w-md sm:p-0 data-open:slide-in-from-bottom-0 data-open:slide-in-from-right-8">
        <div className="flex h-14 shrink-0 items-center border-b border-border px-6">
          <DialogTitle className="font-sans text-[15px] font-medium">
            Filter &amp; sort
          </DialogTitle>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <fieldset className="border-b border-border px-6 py-6">
            <legend className="sr-only">Sort by</legend>
            <p className="mb-4 text-[12px] font-medium tracking-[0.06em] uppercase">
              Sort by
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
              {SORTS.map((sort) => {
                const checked = (draft.sort ?? args.defaultSort) === sort
                return (
                  <label
                    key={sort}
                    className="flex cursor-pointer items-center gap-2.5"
                  >
                    <input
                      type="radio"
                      name="listing-sort"
                      checked={checked}
                      onChange={() =>
                        setDraft((current) => ({
                          ...current,
                          sort: sort === args.defaultSort ? null : sort,
                        }))
                      }
                      className="size-4 accent-foreground"
                    />
                    {SORT_LABELS[sort]}
                  </label>
                )
              })}
            </div>
          </fieldset>

          {FACETS.map((facet) => {
            const values = shownFacets?.[facet] ?? []
            if (!values.length) return null
            const chosen = draft[facet]
            return (
              <details
                key={facet}
                open={chosen.length > 0}
                className="group border-b border-border"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-5 text-[12px] font-medium tracking-[0.06em] uppercase [&::-webkit-details-marker]:hidden">
                  <span>
                    {FACET_LABELS[facet]}
                    {chosen.length > 0 && (
                      <span className="ml-2 tracking-normal text-muted-foreground normal-case">
                        ({chosen.length})
                      </span>
                    )}
                  </span>
                  <span
                    aria-hidden
                    className="text-lg leading-none font-normal transition-transform group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <div className="px-6 pb-6">
                  {facet === "size" ? (
                    <div className="flex flex-wrap gap-1.5">
                      {values.map((entry) => (
                        <button
                          key={entry.value}
                          type="button"
                          aria-pressed={chosen.includes(entry.value)}
                          disabled={
                            !entry.count && !chosen.includes(entry.value)
                          }
                          onClick={() => toggle(facet, entry.value)}
                          className={cn(
                            "h-10 min-w-12 border px-3 text-[13px] tabular-nums transition-colors disabled:cursor-not-allowed disabled:opacity-35",
                            chosen.includes(entry.value)
                              ? "border-foreground bg-foreground text-background"
                              : "border-border hover:border-foreground",
                          )}
                        >
                          {entry.value}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <ul className="grid gap-3 text-[13px] sm:grid-cols-2">
                      {values.map((entry) => (
                        <li key={entry.value}>
                          <label
                            className={cn(
                              "flex cursor-pointer items-center gap-2.5",
                              !entry.count &&
                                !chosen.includes(entry.value) &&
                                "cursor-not-allowed opacity-40",
                            )}
                          >
                            <input
                              type="checkbox"
                              checked={chosen.includes(entry.value)}
                              disabled={
                                !entry.count && !chosen.includes(entry.value)
                              }
                              onChange={() => toggle(facet, entry.value)}
                              className="size-4 shrink-0 accent-foreground"
                            />
                            {facet === "colour" && (
                              <span
                                aria-hidden
                                className="size-3.5 shrink-0 border border-black/10"
                                style={{
                                  backgroundColor: entry.hex ?? undefined,
                                }}
                              />
                            )}
                            <span className="min-w-0 flex-1 truncate">
                              {facetValueLabel(facet, entry.value)}
                            </span>
                            <span className="text-muted-foreground tabular-nums">
                              {entry.count}
                            </span>
                          </label>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </details>
            )
          })}
        </div>

        <div className="grid shrink-0 grid-cols-[auto_1fr] border-t border-border">
          <button
            type="button"
            onClick={() => setDraft(emptyListingState())}
            className="flex h-14 items-center gap-2 px-6 text-[12px] font-medium tracking-[0.06em] text-muted-foreground uppercase hover:text-foreground"
          >
            Reset
            <ArrowCounterClockwiseIcon className="size-4" />
          </button>
          <button
            type="button"
            disabled={count === 0}
            onClick={() => {
              onApply(draft)
              onOpenChange(false)
            }}
            className="flex h-14 items-center justify-between bg-foreground px-6 text-[12px] font-medium tracking-[0.06em] text-background uppercase transition-opacity disabled:opacity-50"
          >
            <span aria-live="polite">
              {count === undefined
                ? "View products"
                : count === 0
                  ? "No products match"
                  : `View ${count} ${count === 1 ? "product" : "products"}`}
            </span>
            <CaretRightIcon className="size-4" />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
