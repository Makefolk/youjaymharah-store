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

export const WISHLIST_PATH = "/wishlist"

/** Full search results. The query travels as `?q=`. */
export const SEARCH_PATH = "/search"

/**
 * An order's status page. Its signed-in customer needs nothing more; anyone
 * else needs the order link's `key`, as in the order emails, so pages pass
 * it along to the order's other pages.
 */
export const orderPath = (id: string, key?: string | null) =>
  `/orders/${encodeURIComponent(id)}${withKey(key)}`

export const orderReturnPath = (id: string, key?: string | null) =>
  `/orders/${encodeURIComponent(id)}/return${withKey(key)}`

const withKey = (key?: string | null) =>
  key ? `?key=${encodeURIComponent(key)}` : ""

export const CHECKOUT_PATH = "/checkout"

/**
 * Where Paystack and Credo send the shopper back. Must match the backend's
 * PAYMENT_CALLBACK_URL.
 */
export const CHECKOUT_CALLBACK_PATH = "/checkout/callback"

/** An order's page straight after checkout, with the thank-you message. */
export const orderConfirmationPath = (id: string, key?: string | null) =>
  `/orders/${encodeURIComponent(id)}?placed=1${key ? `&key=${encodeURIComponent(key)}` : ""}`

/** Finding a guest order from its number and email. */
export const TRACK_ORDER_PATH = "/track-order"

export const PRODUCTS_PATH = "/products"
export const CONTACT_PATH = "/contact"

/** The contact page with its form filled in for the problem at hand. */
export function contactPath({
  order,
  topic,
}: { order?: number | string | null; topic?: string } = {}): string {
  const query = new URLSearchParams()
  if (topic) query.set("topic", topic)
  if (order) query.set("order", String(order))
  const search = query.toString()
  return search ? `${CONTACT_PATH}?${search}` : CONTACT_PATH
}
export const ABOUT_PATH = "/about"
export const PRIVACY_PATH = "/privacy"
export const TERMS_PATH = "/terms"
export const RETURNS_POLICY_PATH = "/help/returns"
export const DELIVERY_PATH = "/help/delivery"

/** The signed-in customer's orders; sends guests to sign in. */
export const ACCOUNT_PATH = "/account"
export const ACCOUNT_DETAILS_PATH = "/account/details"
export const ACCOUNT_ADDRESSES_PATH = "/account/addresses"
export const ACCOUNT_PREFERENCES_PATH = "/account/preferences"
export const ACCOUNT_SUPPORT_PATH = "/account/support"

export const supportRequestPath = (id: string, access?: string | null) =>
  `/support/${encodeURIComponent(id)}${access ? `?access=${encodeURIComponent(access)}` : ""}`

export const orderHelpPath = (
  id: string,
  key?: string | null,
  kind?: string,
) => {
  const query = new URLSearchParams()
  if (kind) query.set("kind", kind)
  if (key) query.set("key", key)
  const search = query.toString()
  return `/orders/${encodeURIComponent(id)}/help${search ? `?${search}` : ""}`
}
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
  "/support/",
  SHOPPING_BAG_PATH,
  WISHLIST_PATH,
  "/checkout",
  // Landing pages for emailed confirm and unsubscribe links: one per token.
  "/newsletter",
]

/** An absolute URL on this storefront, e.g. for structured data. */
export const absoluteUrl = (path: string) =>
  new URL(path, getBaseURL()).toString()
