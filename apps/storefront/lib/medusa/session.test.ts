import { beforeEach, describe, expect, it, vi } from "vitest"

const jar = vi.hoisted(() => ({
  values: new Map<string, string>(),
  set: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      jar.values.has(name) ? { value: jar.values.get(name) } : undefined,
    set: (name: string, value: string, options: unknown) => {
      jar.values.set(name, value)
      jar.set(name, value, options)
    },
    delete: (name: string) => jar.values.delete(name),
  }),
}))
import { consumeGoogleState, setGoogleState } from "./session"

beforeEach(() => {
  jar.values.clear()
  vi.clearAllMocks()
})
describe("OAuth state cookie", () => {
  it("has a short lifetime and is consumed once", async () => {
    await setGoogleState("expected-state")
    expect(jar.set).toHaveBeenCalledWith(
      expect.any(String),
      "expected-state",
      expect.objectContaining({
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 600,
      }),
    )
    expect(await consumeGoogleState("expected-state")).toBe(true)
    expect(await consumeGoogleState("expected-state")).toBe(false)
  })
  it("rejects absent and mismatched state and clears failed attempts", async () => {
    expect(await consumeGoogleState("attacker-state")).toBe(false)
    await setGoogleState("expected-state")
    expect(await consumeGoogleState("attacker-state")).toBe(false)
    expect(await consumeGoogleState("expected-state")).toBe(false)
  })
})
