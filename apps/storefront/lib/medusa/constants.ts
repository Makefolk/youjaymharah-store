/**
 * Values shared by server and browser code. This module ends up in the client
 * bundle, so nothing secret belongs here -- the backend URL lives in
 * lib/medusa/server.ts for that reason.
 */

import type { Wishlist } from "@youjaymharah/api-types"

/** The storefront's own route that forwards Store API calls to Medusa. */
export const MEDUSA_PROXY_PATH = "/api/medusa"

/** Public by design: every Store API request carries it. */
export const PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ?? ""

/** The customer's Medusa token. httpOnly, so browser code can never read it. */
export const AUTH_COOKIE = "_medusa_jwt"

/**
 * The active cart's id. Also httpOnly: Medusa lets anyone holding a guest
 * cart's id change that cart, so the id is treated like a credential.
 */
export const CART_COOKIE = "_medusa_cart_id"

/**
 * The id browser code passes for "the cart in CART_COOKIE". The proxy swaps in
 * the real id, so the browser never needs to know it.
 */
export const CURRENT_CART_ID = "current"

/**
 * A guest's wishlist id, httpOnly for the same reason as the cart's. Signed-in
 * customers don't need it: their list is found through their account.
 */
export const WISHLIST_COOKIE = "_medusa_wishlist_id"

/**
 * The id browser code passes for "this shopper's wishlist": the customer's own
 * list when signed in, otherwise the guest list in WISHLIST_COOKIE.
 */
export const CURRENT_WISHLIST_ID = "current"

/** What a shopper who has never saved anything has. */
export const EMPTY_WISHLIST: Wishlist = { id: null, items: [] }

/** Where to return after a Google sign-in; Google's round trip can't carry it. */
export const SIGN_IN_NEXT_COOKIE = "_signin_next"
export const GOOGLE_STATE_COOKIE = "_google_state"

/**
 * Carries an order link's key (`/orders/:id?key=`) to the backend, which
 * opens an order only for its signed-in customer or with that key.
 */
export const ORDER_ACCESS_HEADER = "x-order-access"
