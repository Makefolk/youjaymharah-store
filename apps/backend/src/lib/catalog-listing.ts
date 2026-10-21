/**
 * Filtering, sorting and facet counts for a storefront product listing.
 * Pure, so the route only has to load the products and the rules can be
 * tested on their own.
 *
 * Done in memory over the listing's products (a category, a collection or
 * the whole catalogue): the Store API can't sort by price or count products
 * per colour and size, and a boutique catalogue is small enough that loading
 * one listing's products per request is cheap.
 */

export const LISTING_SORTS = [
  "recommended",
  "newest",
  "price_asc",
  "price_desc",
] as const;
export type ListingSort = (typeof LISTING_SORTS)[number];

export const FACETS = [
  "type",
  "colour",
  "size",
  "material",
  "fit",
  "feature",
] as const;
export type Facet = (typeof FACETS)[number];

export type ListingFilters = Partial<Record<Facet, string[]>>;

export type ListingProduct = {
  id: string;
  /** Launch date when it was launched from "coming soon", else created. */
  listed_at: string;
  type: string | null;
  material: string | null;
  fit: string | null;
  tags: string[];
  colours: { value: string; hex: string | null; rank: number }[];
  sizes: { value: string; rank: number }[];
  /** The cheapest variant's price in the listing's region. */
  price: number | null;
  /** At least one variant can be bought now. */
  available: boolean;
};

export type FacetValue = { value: string; count: number; hex?: string | null };

export type ListingResult = {
  ids: string[];
  count: number;
  facets: Record<Facet, FacetValue[]>;
};

function valuesOf(product: ListingProduct, facet: Facet): string[] {
  switch (facet) {
    case "type":
      return product.type ? [product.type] : [];
    case "colour":
      return product.colours.map((colour) => colour.value);
    case "size":
      return product.sizes.map((size) => size.value);
    case "material":
      return product.material ? [product.material] : [];
    case "fit":
      return product.fit ? [product.fit] : [];
    case "feature":
      return product.tags;
  }
}

/** Within a facet values are alternatives (OR); across facets they combine (AND). */
function matches(
  product: ListingProduct,
  filters: ListingFilters,
  skip?: Facet,
): boolean {
  return FACETS.every((facet) => {
    const wanted = filters[facet];
    if (facet === skip || !wanted?.length) return true;
    const values = valuesOf(product, facet);
    return wanted.some((value) => values.includes(value));
  });
}

const time = (value: string) => new Date(value).getTime() || 0;

function compare(sort: ListingSort) {
  const newest = (a: ListingProduct, b: ListingProduct) =>
    time(b.listed_at) - time(a.listed_at) || a.id.localeCompare(b.id);
  const byPrice =
    (direction: 1 | -1) => (a: ListingProduct, b: ListingProduct) => {
      if (a.price === null || b.price === null)
        return a.price === b.price ? newest(a, b) : a.price === null ? 1 : -1;
      return (a.price - b.price) * direction || newest(a, b);
    };
  switch (sort) {
    case "newest":
      return newest;
    case "price_asc":
      return byPrice(1);
    case "price_desc":
      return byPrice(-1);
    default:
      // What can be bought first, then the newest.
      return (a: ListingProduct, b: ListingProduct) =>
        Number(b.available) - Number(a.available) || newest(a, b);
  }
}

/**
 * Each facet's values with how many products would show if it were ticked:
 * counted against every other facet's filters but not its own, so ticking a
 * second colour shows how many that adds rather than zero.
 */
function countFacets(
  products: ListingProduct[],
  filters: ListingFilters,
): Record<Facet, FacetValue[]> {
  const result = {} as Record<Facet, FacetValue[]>;
  for (const facet of FACETS) {
    const counts = new Map<string, FacetValue & { rank: number }>();
    for (const product of products) {
      if (!matches(product, filters, facet)) continue;
      const ranked =
        facet === "colour"
          ? product.colours
          : facet === "size"
            ? product.sizes
            : valuesOf(product, facet).map((value) => ({
                value,
                rank: Number.MAX_SAFE_INTEGER,
              }));
      for (const entry of ranked) {
        const existing = counts.get(entry.value);
        if (existing) {
          existing.count += 1;
          existing.rank = Math.min(existing.rank, entry.rank);
        } else {
          counts.set(entry.value, {
            value: entry.value,
            count: 1,
            rank: entry.rank,
            ...("hex" in entry ? { hex: entry.hex as string | null } : {}),
          });
        }
      }
    }
    // Ticked values stay listed even when nothing else matches them, so they
    // can be unticked.
    for (const value of filters[facet] ?? []) {
      if (!counts.has(value))
        counts.set(value, { value, count: 0, rank: Number.MAX_SAFE_INTEGER });
    }
    result[facet] = [...counts.values()]
      .sort((a, b) => a.rank - b.rank || a.value.localeCompare(b.value))
      .map(({ rank: _rank, ...value }) => value);
  }
  return result;
}

export function listCatalog(
  products: ListingProduct[],
  {
    filters = {},
    sort = "recommended",
    offset = 0,
    limit = 24,
  }: {
    filters?: ListingFilters;
    sort?: ListingSort;
    offset?: number;
    limit?: number;
  } = {},
): ListingResult {
  const matching = products
    .filter((product) => matches(product, filters))
    .sort(compare(sort));
  return {
    ids: matching.slice(offset, offset + limit).map((product) => product.id),
    count: matching.length,
    facets: countFacets(products, filters),
  };
}
