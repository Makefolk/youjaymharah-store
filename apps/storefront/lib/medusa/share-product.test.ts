import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { shareProduct } from "./share-product"

const product = { title: "Linen shirt", handle: "linen shirt" }
const url = "https://store.example/products/linen%20shirt"

beforeEach(() => {
  vi.stubGlobal("window", {
    location: {
      origin: "https://store.example",
      href: "https://store.example/search?q=shirts&quickView=linen",
    },
  })
})

afterEach(() => vi.unstubAllGlobals())

describe("shareProduct", () => {
  it("shares the product URL without leaking the listing's query", async () => {
    const share = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal("navigator", { share })

    expect(await shareProduct(product)).toEqual({ status: "shared", url })
    expect(share).toHaveBeenCalledWith({ title: product.title, url })
  })

  it("never copies a link when the native share is cancelled", async () => {
    const writeText = vi.fn()
    vi.stubGlobal("navigator", {
      share: vi.fn().mockRejectedValue(new DOMException("", "AbortError")),
      clipboard: { writeText },
    })

    expect(await shareProduct(product)).toEqual({ status: "cancelled", url })
    expect(writeText).not.toHaveBeenCalled()
  })

  it("copies the link when native sharing is absent or unsupported", async () => {
    for (const native of [{}, { share: vi.fn(), canShare: () => false }]) {
      const writeText = vi.fn().mockResolvedValue(undefined)
      vi.stubGlobal("navigator", { ...native, clipboard: { writeText } })

      expect(await shareProduct(product)).toEqual({ status: "copied", url })
      expect(writeText).toHaveBeenCalledWith(url)
    }
  })

  it("provides a manually copyable URL without either browser API", async () => {
    vi.stubGlobal("navigator", {})
    expect(await shareProduct(product)).toEqual({ status: "unavailable", url })
  })

  it("does not claim success when share or clipboard permission is denied", async () => {
    const error = new DOMException("", "NotAllowedError")
    for (const browser of [
      { share: vi.fn().mockRejectedValue(error) },
      { clipboard: { writeText: vi.fn().mockRejectedValue(error) } },
    ]) {
      vi.stubGlobal("navigator", browser)
      await expect(shareProduct(product)).rejects.toBe(error)
    }
  })
})
