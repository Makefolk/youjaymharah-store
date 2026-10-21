import type { Metadata } from "next"

import { WishlistGrid } from "@/components/wishlist/wishlist-grid"
import { fetchWishlistOnServer } from "@/features/wishlist/server"
import { listProducts } from "@/lib/medusa/catalog"
import { getStorefrontSettings } from "@/lib/medusa/storefront-settings"

export const metadata: Metadata = {
  title: "Your wishlist",
  robots: { index: false },
}

/**
 * The shopper's saved pieces, newest first, priced for their region. Guests
 * have one too (kept in this browser); signing in merges it into the account.
 */
export default async function WishlistPage() {
  const [wishlist, settings] = await Promise.all([
    fetchWishlistOnServer(),
    getStorefrontSettings(),
  ])
  const ids = [
    ...new Set(
      [...wishlist.items]
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
        .map((item) => item.product_id),
    ),
  ]
  const { products } = ids.length
    ? await listProducts({ id: ids, limit: ids.length })
    : { products: [] }
  const byId = new Map(products.map((product) => [product.id, product]))

  return (
    <main className="pt-6 pb-24 md:pt-10">
      <h1 className="px-5 text-center text-2xl font-medium tracking-[-0.01em] sm:px-6">
        Your wishlist
      </h1>
      <WishlistGrid
        // Saved products no longer for sale drop out here.
        products={ids.flatMap((id) => byId.get(id) ?? [])}
        newBadgeDays={settings.products.new_badge_days}
      />
    </main>
  )
}
