import path from "node:path"

import { withSentryConfig } from "@sentry/nextjs"
import type { NextConfig } from "next"

import { securityHeaders } from "./lib/http/security-headers"

type RemotePattern = NonNullable<
  NonNullable<NextConfig["images"]>["remotePatterns"]
>[number]

function imageRemotePatterns(value: string | undefined): RemotePattern[] {
  const entries = (value ?? "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean)

  return entries.map((entry) => {
    let url: URL

    try {
      url = new URL(entry)
    } catch {
      throw new Error(
        `IMAGE_REMOTE_URLS: "${entry}" is not a full URL. Use addresses like https://pub-<hash>.r2.dev,
 separated by commas.`,
      )
    }

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error(
        `IMAGE_REMOTE_URLS: "${entry}" must start with https:// (or http:// for local development).`,
      )
    }

    return {
      protocol: url.protocol === "https:" ? "https" : "http",
      hostname: url.hostname,
      port: url.port,
      pathname: `${url.pathname.replace(/\/+$/, "")}/**`,
    }
  })
}

const remotePatterns = imageRemotePatterns(process.env.IMAGE_REMOTE_URLS)

if (!remotePatterns.length) {
  console.warn(
    "IMAGE_REMOTE_URLS is not set, so next/image will refuse product photos and uploaded logos. See .env.template.",
  )
}

const nextConfig: NextConfig = {
  images: { remotePatterns },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders({
          imageOrigins: process.env.IMAGE_REMOTE_URLS,
          sentryDsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
          development: process.env.NODE_ENV !== "production",
        }),
      },
    ]
  },
  // Set by the Docker build only, so `next start` keeps working locally.
  // Standalone traces just the files the server needs into .next/standalone,
  // from the workspace root so hoisted pnpm packages are included.
  ...(process.env.NEXT_OUTPUT_STANDALONE === "true" && {
    output: "standalone",
    outputFileTracingRoot: path.join(process.cwd(), "../.."),
  }),
}

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Source maps upload only where SENTRY_AUTH_TOKEN exists, so a local build
  // never fails for want of a token.
  silent: !process.env.CI,
  disableLogger: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
})
