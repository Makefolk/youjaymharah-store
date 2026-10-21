import { getBaseURL } from "@/lib/util/env"

/**
 * Public page addresses, in one place so the sitemap, canonical links and
 * structured data agree with the routes. Update these if the page routes are
 * named differently.
 */
export const productPath = (handle: string) =>
  `/products/${encodeURIComponent(handle)}`

export const categoryPath = (handle: string) =>
  `/categories/${encodeURIComponent(handle)}`

export const collectionPath = (handle: string) =>
  `/collections/${encodeURIComponent(handle)}`

/** Every collection, for "View all collections". */
export const COLLECTIONS_PATH = "/collections"

/** Products newest first. */
export const NEW_ARRIVALS_PATH = "/new-arrivals"

/** The cart, called "shopping bag" everywhere a shopper can see it. */
export const SHOPPING_BAG_PATH = "/shopping-bag"

/** Full search results. The query travels as `?q=`. */
export const SEARCH_PATH = "/search"

/** An order's status page; the id is the key, as in the confirmation email. */
export const orderPath = (id: string) => `/orders/${encodeURIComponent(id)}`

export const orderReturnPath = (id: string) => `${orderPath(id)}/return`

export const CHECKOUT_PATH = "/checkout"

/**
 * Where Paystack and Credo send the shopper back. Must match the backend's
 * PAYMENT_CALLBACK_URL.
 */
export const CHECKOUT_CALLBACK_PATH = "/checkout/callback"

/** An order's page straight after checkout, with the thank-you message. */
export const orderConfirmationPath = (id: string) => `${orderPath(id)}?placed=1`

/** Finding a guest order from its number and email. */
export const TRACK_ORDER_PATH = "/track-order"

export const PRODUCTS_PATH = "/products"
export const CONTACT_PATH = "/contact"
export const RETURNS_POLICY_PATH = "/help/returns"
export const DELIVERY_PATH = "/help/delivery"

/** The signed-in customer's orders; sends guests to sign in. */
export const ACCOUNT_PATH = "/account"
export const SIGN_IN_PATH = "/account/sign-in"
export const REGISTER_PATH = "/account/register"
export const FORGOT_PASSWORD_PATH = "/account/forgot-password"
/** Must match the link in the backend's password reset email. */
export const RESET_PASSWORD_PATH = "/account/reset-password"
/** Must match the link in the backend's verification email. */
export const VERIFY_EMAIL_PATH = "/account/verify"

/**
 * Where to go after signing in: `next` when it is a page on this site, so a
 * crafted link can't bounce someone to another domain.
 */
export function safeNextPath(next: unknown): string {
  return typeof next === "string" &&
    next.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/\\")
    ? next
    : ACCOUNT_PATH
}

/** Pages search engines should not crawl: private or per-visitor. */
export const PRIVATE_PATHS = [
  "/api/",
  "/account",
  "/orders/",
  SHOPPING_BAG_PATH,
  "/checkout",
  // Landing pages for emailed confirm and unsubscribe links: one per token.
  "/newsletter",
]

/** An absolute URL on this storefront, e.g. for structured data. */
export const absoluteUrl = (path: string) =>
  new URL(path, getBaseURL()).toString()
