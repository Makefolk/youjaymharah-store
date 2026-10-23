import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const config = vi.hoisted(() => ({ key: "pk_test_readiness" }))
vi.mock("@/lib/medusa/server", () => ({
  MEDUSA_BACKEND_URL: "https://backend.example.test",
}))
vi.mock("@/lib/medusa/constants", () => ({
  get PUBLISHABLE_KEY() {
    return config.key
  },
}))
import { GET } from "./route"

const fetchMock = vi.fn<typeof fetch>()
beforeEach(() => {
  config.key = "pk_test_readiness"
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})
afterEach(() => vi.unstubAllGlobals())

function responses(region = "ng", catalog: unknown = { products: [] }) {
  fetchMock
    .mockResolvedValueOnce(Response.json({ status: "ok" }))
    .mockResolvedValueOnce(
      Response.json({ regions: [{ countries: [{ iso_2: region }] }] }),
    )
    .mockResolvedValueOnce(Response.json(catalog))
}

describe("storefront readiness", () => {
  it("requires usable backend health, the Nigeria region and a valid catalog response", async () => {
    responses()
    const result = await GET()
    expect(result.status).toBe(200)
    expect(await result.json()).toEqual({ status: "ok" })
    expect(result.headers.get("cache-control")).toBe("no-store")
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      cache: "no-store",
      headers: { "x-publishable-api-key": "pk_test_readiness" },
      signal: expect.any(AbortSignal),
    })
  })
  it("refuses readiness when the public key is missing", async () => {
    config.key = ""
    expect((await GET()).status).toBe(503)
    expect(fetchMock).not.toHaveBeenCalled()
  })
  it("fails when Nigeria is not configured", async () => {
    responses("us")
    expect((await GET()).status).toBe(503)
  })
  it("fails when the catalog sends an error-shaped success response", async () => {
    responses("ng", { error: "not a catalog" })
    expect((await GET()).status).toBe(503)
  })
  it.each([0, 1, 2])(
    "fails if dependency %s rejects the request",
    async (failed) => {
      for (let i = 0; i < 3; i++) {
        fetchMock.mockResolvedValueOnce(
          i === failed
            ? new Response("unavailable", { status: 503 })
            : Response.json({}),
        )
      }
      expect((await GET()).status).toBe(503)
    },
  )
  it("does not disclose connection or credential errors", async () => {
    fetchMock.mockRejectedValue(new Error("private-connection-details"))
    const result = await GET()
    expect(result.status).toBe(503)
    expect(await result.json()).toEqual({ status: "unavailable" })
  })
})
