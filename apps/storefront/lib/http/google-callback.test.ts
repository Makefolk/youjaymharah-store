import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  completeSignIn: vi.fn().mockResolvedValue(undefined),
  callback: vi.fn().mockResolvedValue("callback-token"),
  refresh: vi.fn().mockResolvedValue({ token: "authenticated-token" }),
  fetch: vi.fn().mockResolvedValue({}),
  consumeGoogleState: vi.fn().mockResolvedValue(false),
  takeSignInNext: vi.fn().mockResolvedValue(undefined),
}))

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`redirect:${path}`)
  },
}))
vi.mock("@/lib/medusa/auth", () => ({ completeSignIn: mocks.completeSignIn }))
vi.mock("@/lib/medusa/session", () => ({
  takeSignInNext: mocks.takeSignInNext,
  consumeGoogleState: mocks.consumeGoogleState,
}))
vi.mock("@/lib/medusa/server", () => ({
  requestSdk: () => ({
    auth: { callback: mocks.callback, refresh: mocks.refresh },
    client: { fetch: mocks.fetch },
  }),
}))

import { GET } from "@/app/api/auth/google/callback/route"

describe("Google callback browser binding", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.consumeGoogleState.mockResolvedValue(false)
  })
  it("refuses a callback without a matching browser state", async () => {
    const request = new NextRequest(
      "https://store.example/api/auth/google/callback?code=code&state=another-browser",
    )
    await expect(GET(request)).rejects.toThrow("error=google_failed")
    expect(mocks.callback).not.toHaveBeenCalled()
    expect(mocks.completeSignIn).not.toHaveBeenCalled()
  })
  it("completes sign-in only after consuming a matching state", async () => {
    mocks.consumeGoogleState.mockResolvedValue(true)
    const request = new NextRequest(
      "https://store.example/api/auth/google/callback?code=code&state=expected-state",
    )
    await expect(GET(request)).rejects.toThrow("redirect:")
    expect(mocks.consumeGoogleState).toHaveBeenCalledWith("expected-state")
    expect(mocks.callback).toHaveBeenCalledWith("customer", "google", {
      code: "code",
      state: "expected-state",
    })
    expect(mocks.completeSignIn).toHaveBeenCalledWith("authenticated-token")
  })
})
