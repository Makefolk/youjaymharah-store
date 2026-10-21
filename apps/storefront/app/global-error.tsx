"use client"

import * as Sentry from "@sentry/nextjs"
import { useEffect } from "react"

/**
 * When even the root layout fails. It replaces the whole document, so it
 * brings its own <html> and plain styles rather than the site's.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          fontFamily: "system-ui, sans-serif",
          color: "#111",
          background: "#fff",
        }}
      >
        <main style={{ maxWidth: 420, margin: "0 auto", padding: "96px 20px" }}>
          <h1 style={{ fontSize: 24, fontWeight: 500 }}>
            Something went wrong
          </h1>
          <p style={{ color: "#555", lineHeight: 1.6 }}>
            The store didn&apos;t load properly. It&apos;s usually brief: try
            again in a moment.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: 16,
              padding: "12px 20px",
              background: "#111",
              color: "#fff",
              border: 0,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              cursor: "pointer",
            }}
          >
            Try again
          </button>
          {error.digest && (
            <p style={{ marginTop: 32, fontSize: 13, color: "#777" }}>
              Reference {error.digest}
            </p>
          )}
        </main>
      </body>
    </html>
  )
}
