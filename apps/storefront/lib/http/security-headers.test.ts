import { describe, expect, it } from "vitest"

import { contentSecurityPolicy } from "./security-headers"

describe("content security policy", () => {
  const policy = contentSecurityPolicy({
    imageOrigins: "https://pub-abc.r2.dev, https://files.example.com/media",
    sentryDsn: "https://key@o123.ingest.sentry.io/456",
    development: false,
  })

  it("refuses framing, plugins and foreign forms", () => {
    expect(policy).toContain("frame-ancestors 'none'")
    expect(policy).toContain("object-src 'none'")
    expect(policy).toContain("form-action 'self'")
  })

  it("loads images from the configured hosts and reports only to Sentry", () => {
    expect(policy).toContain(
      "img-src 'self' data: blob: https://pub-abc.r2.dev https://files.example.com",
    )
    expect(policy).toContain("connect-src 'self' https://o123.ingest.sentry.io")
    expect(policy).not.toContain("unsafe-eval")
    expect(policy).toContain("upgrade-insecure-requests")
  })

  it("allows development's fast refresh", () => {
    const dev = contentSecurityPolicy({ development: true })
    expect(dev).toContain("'unsafe-eval'")
    expect(dev).toContain("connect-src 'self' ws:")
    expect(dev).not.toContain("upgrade-insecure-requests")
  })

  it("skips values it can't read", () => {
    expect(
      contentSecurityPolicy({
        imageOrigins: "not a url",
        sentryDsn: "nope",
        development: false,
      }),
    ).toContain("img-src 'self' data: blob:;")
  })
})
