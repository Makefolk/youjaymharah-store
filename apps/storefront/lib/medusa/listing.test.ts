import { describe, expect, it } from "vitest"

import {
  activeLayout,
  catalogQuery,
  countActiveFilters,
  emptyListingState,
  facetValueLabel,
  loadListingState,
  loadListingView,
  viewToLayout,
} from "./listing"

describe("loadListingState", () => {
  it("reads sort and comma-separated filters from the URL", () => {
    const state = loadListingState({
      sort: "price_asc",
      colour: "Black,Navy",
      size: "M",
    })
    expect(state.sort).toBe("price_asc")
    expect(state.colour).toEqual(["Black", "Navy"])
    expect(state.size).toEqual(["M"])
    expect(state.material).toEqual([])
    expect(countActiveFilters(state)).toBe(3)
  })

  it("ignores an unknown sort", () => {
    expect(loadListingState({ sort: "cheapest" }).sort).toBeNull()
  })

  it("keeps the layout out of the filters", () => {
    const params = { view: "compact", colour: "Black" }
    expect(loadListingState(params)).not.toHaveProperty("view")
    expect(loadListingView(params)).toBe("compact")
    expect(viewToLayout(loadListingView(params))).toBe(2)
    expect(loadListingView({ view: "huge" })).toBeNull()
    expect(viewToLayout(null)).toBeNull()
  })
})

describe("catalogQuery", () => {
  it("sends only the filters in use, in a stable order", () => {
    const state = { ...emptyListingState(), colour: ["Navy", "Black"] }
    expect(
      catalogQuery({ category: "women" }, state, {
        regionId: "reg_1",
        defaultSort: "recommended",
        offset: 24,
      }),
    ).toEqual({
      region_id: "reg_1",
      sort: "recommended",
      offset: 24,
      limit: 24,
      category: "women",
      colour: ["Black", "Navy"],
    })
  })
})

it("labels tags as words and leaves other values alone", () => {
  expect(facetValueLabel("feature", "limited-edition")).toBe("Limited edition")
  expect(facetValueLabel("colour", "Pale Blue")).toBe("Pale Blue")
})

it("defaults phones to two columns and desktops to four", () => {
  expect(activeLayout(null, "mobile")).toBe(1)
  expect(activeLayout(null, "desktop")).toBe(0)
  expect(activeLayout(2, "mobile")).toBe(2)
})
