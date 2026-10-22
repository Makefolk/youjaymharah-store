import { afterEach, describe, expect, it, vi } from "vitest"
import { readBoundedBody, readJsonBody } from "./request-body"

afterEach(() => vi.useRealTimers())

describe("request body limits", () => {
  it("rejects oversized declared and streamed bodies", async () => {
    await expect(
      readBoundedBody(
        new Request("https://store.example", {
          method: "POST",
          body: "small",
          headers: { "content-length": "100" },
        }),
        10,
      ),
    ).rejects.toMatchObject({ status: 413 })
    await expect(
      readBoundedBody(
        new Request("https://store.example", {
          method: "POST",
          body: "larger than ten bytes",
        }),
        10,
      ),
    ).rejects.toMatchObject({ status: 413 })
  })

  it("cancels a stalled upload", async () => {
    vi.useFakeTimers()
    const cancel = vi.fn()
    const body = new ReadableStream({ cancel })
    const request = new Request("https://store.example", {
      method: "POST",
      body,
      duplex: "half",
    } as RequestInit)
    const result = expect(readBoundedBody(request)).rejects.toMatchObject({
      status: 408,
    })
    await vi.advanceTimersByTimeAsync(10_000)
    await result
    expect(cancel).toHaveBeenCalledOnce()
  })

  it("allows the explicit support-photo limit and normal JSON", async () => {
    const photo = "a".repeat(100_000)
    expect(
      (
        await readBoundedBody(
          new Request("https://store.example", {
            method: "POST",
            body: photo,
          }),
          15 * 1024 * 1024,
        )
      ).byteLength,
    ).toBe(photo.length)
    expect(
      await readJsonBody(
        new Request("https://store.example", {
          method: "POST",
          body: '{"email":"customer@example.com"}',
        }),
      ),
    ).toEqual({ email: "customer@example.com" })
  })
})
