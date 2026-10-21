import Medusa from "@medusajs/js-sdk"

import { MEDUSA_PROXY_PATH, PUBLISHABLE_KEY } from "./constants"

let browserSdk: Medusa | undefined

/**
 * The SDK for Client Components. It talks to this storefront's own
 * /api/medusa proxy, never to Medusa directly: the proxy adds the customer's
 * token from an httpOnly cookie, and staying same-origin avoids a CORS
 * preflight on every call (Medusa sets no Access-Control-Max-Age).
 *
 * Built lazily from window.location.origin because the SDK needs an absolute
 * base URL, and a fixed one would break on preview deployments. That also makes
 * it browser-only: Server Components use lib/medusa/server.ts, and a query that
 * runs during server rendering must be prefetched with a server query function.
 *
 * Do not call `sdk.auth.*` with this instance. Login returns the token in the
 * response body, and keeping it out of the browser is the point; the
 * /api/auth/* routes handle authentication instead.
 */
export function getBrowserSdk(): Medusa {
  if (typeof window === "undefined") {
    throw new TypeError(
      "getBrowserSdk() is browser-only. Use the SDK from lib/medusa/server.ts on the server.",
    )
  }

  browserSdk ??= new Medusa({
    baseUrl: `${window.location.origin}${MEDUSA_PROXY_PATH}`,
    publishableKey: PUBLISHABLE_KEY,
    // "session" only so the SDK sends this site's cookies to the proxy, which
    // reads the token from them; with "jwt" it fetches with
    // `credentials: "omit"` and every call arrives signed out. No token or
    // Medusa session is involved: the proxy forwards no cookies to Medusa.
    auth: { type: "session", fetchCredentials: "same-origin" },
  })

  return browserSdk
}
