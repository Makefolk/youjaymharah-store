import { describe, expect, it } from "vitest"

import { isCollectionLinkAvailable } from "./collection"

const origin = "https://shop.example.com"

describe("collection links in homepage content", () => {
  it.each([
    "/collections",
    "/collections/",
    "/collections?source=hero",
    "/collections/autumn#pieces",
    "https://shop.example.com/collections/autumn",
  ])("hides %s when no collections exist", (href) => {
    expect(isCollectionLinkAvailable(href, [], origin)).toBe(false)
  })

  it("keeps an available collection and the index, but hides a deleted collection", () => {
    const collections = [{ handle: "summer" }, { handle: "" }]
    expect(isCollectionLinkAvailable("/collections", collections, origin)).toBe(
      true,
    )
    expect(
      isCollectionLinkAvailable(
        "/collections/summer/?source=hero",
        collections,
        origin,
      ),
    ).toBe(true)
    expect(
      isCollectionLinkAvailable("/collections/autumn", collections, origin),
    ).toBe(false)
    expect(
      isCollectionLinkAvailable("/collections", [{ handle: " " }], origin),
    ).toBe(false)
  })

  it("preserves product links and links to another site's collections", () => {
    expect(isCollectionLinkAvailable("/products", [], origin)).toBe(true)
    expect(
      isCollectionLinkAvailable(
        "https://editorial.example.com/collections/autumn",
        [],
        origin,
      ),
    ).toBe(true)
  })

  it("matches encoded handles and rejects malformed collection links", () => {
    expect(
      isCollectionLinkAvailable(
        "/collections/caf%C3%A9",
        [{ handle: "café" }],
        origin,
      ),
    ).toBe(true)
    expect(
      isCollectionLinkAvailable(
        "/collections/%ZZ",
        [{ handle: "summer" }],
        origin,
      ),
    ).toBe(false)
  })
})
