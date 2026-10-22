import "server-only"

import { timingSafeEqual } from "node:crypto"

import { cookies } from "next/headers"

import {
  AUTH_COOKIE,
  CART_COOKIE,
  GOOGLE_STATE_COOKIE,
  SIGN_IN_NEXT_COOKIE,
  WISHLIST_COOKIE,
} from "./constants"

/**
 * Must not outlive the token inside it. Medusa signs customer tokens for its
 * `jwtExpiresIn` setting, which defaults to one day -- raise both together.
 */
const AUTH_MAX_AGE_SECONDS = 60 * 60 * 24

/** A basket is worth keeping for longer than a login. */
const CART_MAX_AGE_SECONDS = 60 * 60 * 24 * 30

/**
 * Renewed on every save. The backend deletes guest wishlists after the same
 * 90 days without a save (jobs/delete-stale-guest-wishlists.ts), so change
 * both together.
 */
const WISHLIST_MAX_AGE_SECONDS = 60 * 60 * 24 * 90

const baseCookie = {
  httpOnly: true,
  // Local development runs over plain http, where a Secure cookie is dropped.
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
} as const

// Reading works anywhere on the server. Setting and deleting only work in Route
// Handlers (and Server Functions); Next.js refuses during Server Component
// rendering, because the response has already started streaming.

export async function getAuthToken(): Promise<string | undefined> {
  return (await cookies()).get(AUTH_COOKIE)?.value
}

export async function setAuthToken(token: string): Promise<void> {
  ;(await cookies()).set(AUTH_COOKIE, token, {
    ...baseCookie,
    maxAge: AUTH_MAX_AGE_SECONDS,
  })
}

export async function clearAuthToken(): Promise<void> {
  ;(await cookies()).delete(AUTH_COOKIE)
}

export async function getCartId(): Promise<string | undefined> {
  return (await cookies()).get(CART_COOKIE)?.value
}

export async function setCartId(cartId: string): Promise<void> {
  ;(await cookies()).set(CART_COOKIE, cartId, {
    ...baseCookie,
    maxAge: CART_MAX_AGE_SECONDS,
  })
}

export async function clearCartId(): Promise<void> {
  ;(await cookies()).delete(CART_COOKIE)
}

export async function getWishlistId(): Promise<string | undefined> {
  return (await cookies()).get(WISHLIST_COOKIE)?.value
}

export async function setWishlistId(wishlistId: string): Promise<void> {
  ;(await cookies()).set(WISHLIST_COOKIE, wishlistId, {
    ...baseCookie,
    maxAge: WISHLIST_MAX_AGE_SECONDS,
  })
}

export async function clearWishlistId(): Promise<void> {
  ;(await cookies()).delete(WISHLIST_COOKIE)
}

/** Long enough to choose an account on Google's screen, not much longer. */
const SIGN_IN_NEXT_MAX_AGE_SECONDS = 60 * 10

export async function setSignInNext(path: string): Promise<void> {
  ;(await cookies()).set(SIGN_IN_NEXT_COOKIE, path, {
    ...baseCookie,
    maxAge: SIGN_IN_NEXT_MAX_AGE_SECONDS,
  })
}

/** Reads and clears it: one sign-in, one return. */
export async function takeSignInNext(): Promise<string | undefined> {
  const store = await cookies()
  const value = store.get(SIGN_IN_NEXT_COOKIE)?.value
  store.delete(SIGN_IN_NEXT_COOKIE)
  return value
}

export async function setGoogleState(state: string): Promise<void> {
  ;(await cookies()).set(GOOGLE_STATE_COOKIE, state, {
    ...baseCookie,
    maxAge: SIGN_IN_NEXT_MAX_AGE_SECONDS,
  })
}

export async function consumeGoogleState(
  state: string | null,
): Promise<boolean> {
  const store = await cookies()
  const expected = store.get(GOOGLE_STATE_COOKIE)?.value
  store.delete(GOOGLE_STATE_COOKIE)
  if (!expected || !state || state.length > 256) return false
  const a = Buffer.from(expected)
  const b = Buffer.from(state)
  return a.length === b.length && timingSafeEqual(a, b)
}
