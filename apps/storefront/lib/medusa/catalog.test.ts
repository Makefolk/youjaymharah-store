import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))
vi.mock("./server", () => ({ sdk: { client: { fetch: vi.fn() } } }))

import { listCollections } from "./catalog"
import { sdk } from "./server"

const fetch = vi.mocked(sdk.client.fetch)

describe("collection availability", () => {
  beforeEach(() => {
    fetch.mockReset()
  })

  it("returns an empty store without further requests", async () => {
    fetch.mockResolvedValue({ collections: [], count: 0 })
    expect(await listCollections()).toEqual([])
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("includes collections after the first API page so their links stay available", async () => {
    const first = Array.from({ length: 100 }, (_, index) => ({
      id: `col_${index}`,
      handle: `collection-${index}`,
    }))
    const last = { id: "col_last", handle: "new-season" }
    fetch.mockResolvedValueOnce({ collections: first, count: 101 })
    fetch.mockResolvedValueOnce({ collections: [last], count: 101 })
    expect(await listCollections()).toEqual([...first, last])
    expect(fetch).toHaveBeenNthCalledWith(
      2,
      "/store/collections",
      expect.objectContaining({
        query: expect.objectContaining({ limit: 100, offset: 100 }),
      }),
    )
  })

  it("does not classify a backend failure as an empty collection list", async () => {
    fetch.mockRejectedValue(new Error("Backend unavailable"))
    await expect(listCollections()).rejects.toMatchObject({
      message: "Backend unavailable",
    })
  })
})
