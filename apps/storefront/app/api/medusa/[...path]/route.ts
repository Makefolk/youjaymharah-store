import type { NextRequest } from "next/server"

import { crossOriginRefused, isSameOrigin } from "@/lib/http/same-origin"
import { readBoundedBody, RequestBodyError } from "@/lib/http/request-body"
import {
  CURRENT_CART_ID,
  CURRENT_WISHLIST_ID,
  EMPTY_WISHLIST,
} from "@/lib/medusa/constants"
import { MEDUSA_BACKEND_URL } from "@/lib/medusa/server"
import {
  clearCartId,
  clearWishlistId,
  getAuthToken,
  getCartId,
  getWishlistId,
  setCartId,
  setWishlistId,
} from "@/lib/medusa/session"

/**
 * The browser's only way into Medusa.
 *
 * Forwards Store API calls from Client Components (lib/medusa/browser.ts) to the
 * backend and attaches the customer's token from the httpOnly cookie, so the
 * token never reaches browser JavaScript.
 *
 * This forwards requests verbatim with fetch rather than the SDK: it must pass
 * Medusa's status codes and bodies through untouched, while the SDK parses
 * responses and throws on errors.
 *
 * Two addresses are rewritten, so browser code never handles their ids:
 * `/store/carts/current/...` and `/store/wishlists/current/...`.
 */

/** Only these request headers reach Medusa -- never the browser's cookies. */
const FORWARDED_REQUEST_HEADERS = [
  "accept",
  "content-type",
  "x-publishable-api-key",
  "x-medusa-locale",
  "x-forwarded-for",
]

type WishlistTarget =
  /** The signed-in customer's own list. */
  | { kind: "customer"; segments: string[] }
  /** The guest list in the cookie. */
  | { kind: "guest"; segments: string[] }
  /** A guest's first save, which creates their list. */
  | { kind: "create"; segments: string[] }

/**
 * Maps `/store/wishlists/current/...` onto the backend's two wishlist APIs.
 * Returns a Response when the answer is known without asking Medusa, and null
 * for any other path.
 */
async function resolveCurrentWishlist(
  segments: string[],
  method: string,
): Promise<WishlistTarget | Response | null> {
  if (segments[1] !== "wishlists" || segments[2] !== CURRENT_WISHLIST_ID) {
    return null
  }

  // [] for the list, ["items"] to save, ["items", id] to remove.
  const rest = segments.slice(3)

  if (await getAuthToken()) {
    return {
      kind: "customer",
      segments: ["store", "customers", "me", "wishlist", ...rest],
    }
  }

  const wishlistId = await getWishlistId()

  if (wishlistId) {
    return {
      kind: "guest",
      segments: ["store", "wishlists", wishlistId, ...rest],
    }
  }

  // A guest who has never saved anything: the same empty list a new customer
  // gets, rather than an error.
  if (method === "GET" && rest.length === 0) {
    return Response.json(
      { wishlist: EMPTY_WISHLIST },
      { headers: { "cache-control": "no-store" } },
    )
  }

  if (method === "POST" && rest.length === 1 && rest[0] === "items") {
    return { kind: "create", segments: ["store", "wishlists"] }
  }

  return Response.json({ message: "No active wishlist." }, { status: 404 })
}

async function proxy(
  request: NextRequest,
  context: RouteContext<"/api/medusa/[...path]">,
): Promise<Response> {
  const startedAt = performance.now()
  const { path } = await context.params

  // Next.js resolves "." and ".." (including %2e%2e) before routing, so such a
  // request arrives here already normalised and meets the prefix check below.
  // This guard is defence in depth, should a dot segment ever reach us intact.
  if (
    path.some(
      (segment) => segment === "" || segment === "." || segment === "..",
    )
  ) {
    return Response.json({ message: "Invalid path." }, { status: 400 })
  }

  if (path[0] !== "store") {
    return Response.json({ message: "Not found." }, { status: 404 })
  }

  if (request.method !== "GET" && !isSameOrigin(request)) {
    return crossOriginRefused()
  }

  let segments = [...path]
  const usesCurrentCart =
    segments[1] === "carts" && segments[2] === CURRENT_CART_ID

  if (usesCurrentCart) {
    const cartId = await getCartId()

    if (!cartId) {
      return Response.json({ message: "No active cart." }, { status: 404 })
    }

    segments[2] = cartId
  }

  const wishlist = await resolveCurrentWishlist(segments, request.method)

  if (wishlist instanceof Response) {
    return wishlist
  }

  if (wishlist) {
    segments = wishlist.segments
  }

  const target = new URL(
    `/${segments.map(encodeURIComponent).join("/")}${request.nextUrl.search}`,
    MEDUSA_BACKEND_URL,
  )

  // Belt and braces for the traversal check above.
  if (!target.pathname.startsWith("/store/")) {
    return Response.json({ message: "Not found." }, { status: 404 })
  }

  const headers = new Headers()

  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name)

    if (value) {
      headers.set(name, value)
    }
  }

  const token = await getAuthToken()

  if (token) {
    headers.set("authorization", `Bearer ${token}`)
  }

  const hasBody = request.method !== "GET" && request.method !== "HEAD"
  const acceptsPhotos =
    request.method === "POST" &&
    segments.length === 4 &&
    ((segments[1] === "orders" && segments[3] === "help") ||
      (segments[1] === "support-requests" && segments[3] === "messages"))

  let upstream: Response

  try {
    upstream = await fetch(target, {
      method: request.method,
      headers,
      body: hasBody
        ? await readBoundedBody(
            request,
            acceptsPhotos ? 15 * 1024 * 1024 : 64 * 1024,
          )
        : undefined,
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(30_000)]),
      cache: "no-store",
      redirect: "manual",
    })
  } catch (error) {
    if (error instanceof RequestBodyError) {
      return Response.json({ message: error.message }, { status: error.status })
    }
    // Medusa is unreachable: down, restarting, or MEDUSA_BACKEND_URL is wrong.
    // Answer like an API, so the SDK throws a normal FetchError, instead of
    // letting Next.js turn the exception into a bare 500.
    console.error(
      `Medusa proxy: ${request.method} ${target.pathname} could not reach the backend`,
      error,
    )

    return Response.json(
      { message: "The store is temporarily unavailable. Please try again." },
      { status: 502, headers: { "cache-control": "no-store" } },
    )
  }

  const responseHeaders = new Headers({
    "cache-control": "no-store",
    // Shows up in the browser's Network tab: how long Medusa took to answer.
    "server-timing": `medusa;dur=${(performance.now() - startedAt).toFixed(1)}`,
  })
  const contentType = upstream.headers.get("content-type")

  if (contentType) {
    responseHeaders.set("content-type", contentType)
  }
  const retryAfter = upstream.headers.get("retry-after")
  if (retryAfter) responseHeaders.set("retry-after", retryAfter)

  if (wishlist?.kind === "create" && upstream.ok) {
    const body = (await upstream.json()) as { wishlist?: { id: string } }

    if (body.wishlist?.id) {
      await setWishlistId(body.wishlist.id)
    }

    return Response.json(body, {
      status: upstream.status,
      headers: responseHeaders,
    })
  }

  if (wishlist?.kind === "guest") {
    const readsList = request.method === "GET" && segments.length === 3

    // The guest list was merged into an account, or cleaned up after 90 days
    // without a save. Only the plain read is unambiguous: a save can also 404
    // because the product was unpublished.
    if (readsList && upstream.status === 404) {
      await clearWishlistId()

      return Response.json(
        { wishlist: EMPTY_WISHLIST },
        { headers: responseHeaders },
      )
    }

    // Each change renews the cookie, so an active list never expires.
    if (request.method !== "GET" && upstream.ok) {
      await setWishlistId(segments[2])
    }
  }

  const isCartCreate =
    request.method === "POST" &&
    segments.length === 2 &&
    segments[1] === "carts"
  const isCartComplete =
    usesCurrentCart && segments[3] === "complete" && request.method === "POST"

  // The two responses that change which cart the cookie should point at are
  // read here; every other response streams straight through.
  if (upstream.ok && (isCartCreate || isCartComplete)) {
    const body = (await upstream.json()) as {
      type?: "order" | "cart"
      cart?: { id: string }
    }

    if (isCartCreate && body.cart?.id) {
      await setCartId(body.cart.id)
    }

    // A completed cart became an order; the next add-to-cart starts afresh.
    if (isCartComplete && body.type === "order") {
      await clearCartId()
    }

    return Response.json(body, {
      status: upstream.status,
      headers: responseHeaders,
    })
  }

  // The cookie points at a cart that was completed or deleted elsewhere.
  if (usesCurrentCart && upstream.status === 404) {
    await clearCartId()
  }

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  })
}

export { proxy as DELETE, proxy as GET, proxy as POST }
