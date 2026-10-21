import { listCatalog, type ListingProduct } from "../catalog-listing";

const product = (
  id: string,
  overrides: Partial<ListingProduct> = {},
): ListingProduct => ({
  id,
  listed_at: "2026-10-01T00:00:00.000Z",
  type: "Dress",
  material: "Linen",
  fit: "Relaxed",
  tags: [],
  colours: [{ value: "Black", hex: "#111111", rank: 0 }],
  sizes: [
    { value: "S", rank: 1 },
    { value: "M", rank: 2 },
  ],
  price: 100,
  available: true,
  ...overrides,
});

const catalogue = [
  product("old_cheap", { listed_at: "2026-09-01T00:00:00.000Z", price: 50 }),
  product("new_dear", { listed_at: "2026-10-10T00:00:00.000Z", price: 300 }),
  product("sold_out_newest", {
    listed_at: "2026-10-20T00:00:00.000Z",
    available: false,
    colours: [{ value: "Navy", hex: "#1f2a44", rank: 1 }],
    sizes: [{ value: "XS", rank: 0 }],
  }),
  product("no_price", { type: "Top", price: null, material: null }),
];

describe("listCatalog sorting", () => {
  it("recommends what can be bought, newest first", () => {
    expect(listCatalog(catalogue).ids).toEqual([
      "new_dear",
      "no_price",
      "old_cheap",
      "sold_out_newest",
    ]);
  });

  it("sorts by price with unpriced products last", () => {
    expect(listCatalog(catalogue, { sort: "price_asc" }).ids).toEqual([
      "old_cheap",
      "sold_out_newest",
      "new_dear",
      "no_price",
    ]);
    expect(listCatalog(catalogue, { sort: "price_desc" }).ids[0]).toBe(
      "new_dear",
    );
  });

  it("pages without losing the total", () => {
    const page = listCatalog(catalogue, {
      sort: "newest",
      offset: 1,
      limit: 2,
    });
    expect(page).toMatchObject({ ids: ["new_dear", "no_price"], count: 4 });
  });
});

describe("listCatalog filters and facets", () => {
  it("ORs values within a facet and ANDs facets", () => {
    const result = listCatalog(catalogue, {
      filters: { colour: ["Black", "Navy"], type: ["Dress"] },
    });
    expect(result.count).toBe(3);
  });

  it("counts each facet against the other filters only", () => {
    const { facets } = listCatalog(catalogue, {
      filters: { colour: ["Navy"] },
    });
    expect(facets.colour).toEqual([
      { value: "Black", count: 3, hex: "#111111" },
      { value: "Navy", count: 1, hex: "#1f2a44" },
    ]);
    expect(facets.size).toEqual([{ value: "XS", count: 1 }]);
    expect(facets.type).toEqual([{ value: "Dress", count: 1 }]);
  });

  it("orders sizes by the admin's rank and keeps ticked values listed", () => {
    const { facets } = listCatalog(catalogue, {
      filters: { material: ["Silk"] },
    });
    expect(facets.size.map((size) => size.value)).toEqual([]);
    expect(facets.material).toEqual([
      { value: "Linen", count: 3 },
      { value: "Silk", count: 0 },
    ]);
    expect(
      listCatalog(catalogue).facets.size.map((size) => size.value),
    ).toEqual(["XS", "S", "M"]);
  });
});
