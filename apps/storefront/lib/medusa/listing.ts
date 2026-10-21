import type { StoreCatalogResponse } from "@youjaymharah/api-types"
import {
  createLoader,
  parseAsArrayOf,
  parseAsStringLiteral,
  parseAsString,
  type LoaderInput,
} from "nuqs/server"

/**
 * Product listing pages (categories, new arrivals): their URL state, labels
 * and layouts. Shared by the server render and the browser, so a filtered
 * link renders the same on both.
 */

export const LISTING_PAGE_SIZE = 24

export const SORTS = [
  "recommended",
  "newest",
  "price_asc",
  "price_desc",
] as const
export type ListingSortOption = (typeof SORTS)[number]

export const SORT_LABELS: Record<ListingSortOption, string> = {
  recommended: "Recommended",
  newest: "Newest",
  price_asc: "Lowest price",
  price_desc: "Highest price",
}

export const FACETS = [
  "type",
  "colour",
  "size",
  "material",
  "fit",
  "feature",
] as const
export type ListingFacet = (typeof FACETS)[number]

export const FACET_LABELS: Record<ListingFacet, string> = {
  type: "Product type",
  colour: "Colour",
  size: "Size",
  material: "Material",
  fit: "Fit",
  feature: "Product feature",
}

/** The three layouts by name, as they appear in the URL (`?view=compact`). */
export const VIEWS = ["large", "medium", "compact"] as const
export type ListingView = (typeof VIEWS)[number]

/** URL parsers: `?view=medium&sort=newest&colour=Black,Navy&size=M`. */
export const listingParsers = {
  view: parseAsStringLiteral(VIEWS),
  sort: parseAsStringLiteral(SORTS),
  ...(Object.fromEntries(
    FACETS.map((facet) => [
      facet,
      parseAsArrayOf(parseAsString).withDefault([]),
    ]),
  ) as Record<
    ListingFacet,
    ReturnType<typeof parseAsArrayOf<string>> & {
      readonly defaultValue: string[]
    }
  >),
}

const loadListingParams = createLoader(listingParsers)

/** The filters and sort from the URL; the layout is read separately. */
export function loadListingState(input: LoaderInput): ListingState {
  const { view: _view, ...state } = loadListingParams(input)
  return state
}

export function loadListingView(input: LoaderInput): ListingView | null {
  return loadListingParams(input).view
}

export type ListingState = {
  sort: ListingSortOption | null
} & Record<ListingFacet, string[]>

export type ListingScope = { category?: string; collection?: string }

export function emptyListingState(): ListingState {
  return {
    sort: null,
    type: [],
    colour: [],
    size: [],
    material: [],
    fit: [],
    feature: [],
  }
}

export function countActiveFilters(state: ListingState): number {
  return FACETS.reduce((total, facet) => total + state[facet].length, 0)
}

/** The /store/catalog query for one page. */
export function catalogQuery(
  scope: ListingScope,
  state: ListingState,
  {
    regionId,
    defaultSort,
    offset = 0,
    limit = LISTING_PAGE_SIZE,
  }: {
    regionId: string
    defaultSort: ListingSortOption
    offset?: number
    limit?: number
  },
): Record<string, string | number | string[]> {
  return {
    region_id: regionId,
    sort: state.sort ?? defaultSort,
    offset,
    limit,
    ...(scope.category ? { category: scope.category } : {}),
    ...(scope.collection ? { collection: scope.collection } : {}),
    ...Object.fromEntries(
      FACETS.filter((facet) => state[facet].length).map((facet) => [
        facet,
        [...state[facet]].sort(),
      ]),
    ),
  }
}

/** Tags are slugs ("new-arrival"); show them as words. */
export function facetValueLabel(facet: ListingFacet, value: string): string {
  if (facet !== "feature") return value
  const words = value.replace(/[-_]+/g, " ").trim()
  return words.charAt(0).toUpperCase() + words.slice(1)
}

export type ListingFacets = StoreCatalogResponse["facets"]

/**
 * The three layouts. Phones show 1, 2 or 3 columns; tablets 3, 4 or 6;
 * desktops 4, 6 or 10. The densest shows photos only. Until the shopper
 * picks one, phones get 2 columns and desktops 4.
 */
export const LAYOUTS = [
  {
    grid: "grid-cols-1 md:grid-cols-3 lg:grid-cols-4",
    mobileColumns: 1,
    desktopColumns: 4,
    details: true,
  },
  {
    grid: "grid-cols-2 md:grid-cols-4 lg:grid-cols-6",
    mobileColumns: 2,
    desktopColumns: 6,
    details: true,
  },
  {
    grid: "grid-cols-3 md:grid-cols-6 lg:grid-cols-10",
    mobileColumns: 3,
    desktopColumns: 10,
    details: false,
  },
] as const

export type LayoutIndex = 0 | 1 | 2

export function viewToLayout(view: ListingView | null): LayoutIndex | null {
  return view === null ? null : (VIEWS.indexOf(view) as LayoutIndex)
}

export const DEFAULT_LAYOUT_GRID = "grid-cols-2 md:grid-cols-3 lg:grid-cols-4"

/** Which toggle reads as chosen when the shopper hasn't picked one. */
export function activeLayout(
  chosen: LayoutIndex | null,
  breakpoint: "mobile" | "desktop",
): LayoutIndex {
  return chosen ?? (breakpoint === "mobile" ? 1 : 0)
}
