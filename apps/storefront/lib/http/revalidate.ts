import { timingSafeEqual } from "node:crypto"

/** Cache tags the backend may refresh; anything else is refused. */
const FIXED_TAGS = new Set([
  "storefront-settings",
  "products",
  "categories",
  "collections",
])

/** `product:<handle>`, the tag on one product page. */
const PRODUCT_TAG = /^product:[a-z0-9][a-z0-9-]{0,199}$/

export function isRevalidatableTag(tag: unknown): tag is string {
  return (
    typeof tag === "string" && (FIXED_TAGS.has(tag) || PRODUCT_TAG.test(tag))
  )
}

/** Constant-time, and false whenever the secret isn't configured. */
export function hasRevalidateSecret(
  given: string | null,
  expected: string | undefined,
): boolean {
  if (!given || !expected) return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}
