import type { HttpTypes } from "@medusajs/types"

import { productPath } from "@/lib/seo/routes"

export type ProductShareResult = {
  /** "shared" means handed to the native UI, not proof of delivery. */
  status: "shared" | "copied" | "cancelled" | "unavailable"
  /** Show this for manual copying when sharing/clipboard APIs are absent. */
  url: string
}

/**
 * Call directly from a Client Component's click handler, before other awaited
 * work: native sharing requires user activation and a secure context. Shares
 * the product page, never the listing's filters or quick-view state.
 *
 * Uses native share when supported, otherwise copies the link. Cancellation
 * stays silent and does not copy anything. Other failures reject so the UI
 * can show an error/retry; only "copied" should announce "Link copied".
 * https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share
 */
export async function shareProduct(
  product: Pick<HttpTypes.StoreProduct, "title" | "handle">,
): Promise<ProductShareResult> {
  const url = new URL(productPath(product.handle), window.location.origin).href
  const data = { title: product.title, url }

  if (
    typeof navigator.share === "function" &&
    (typeof navigator.canShare !== "function" || navigator.canShare(data))
  ) {
    try {
      await navigator.share(data)
      return { status: "shared", url }
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        return { status: "cancelled", url }
      }

      throw error
    }
  }

  if (typeof navigator.clipboard?.writeText === "function") {
    await navigator.clipboard.writeText(url)
    return { status: "copied", url }
  }

  return { status: "unavailable", url }
}
