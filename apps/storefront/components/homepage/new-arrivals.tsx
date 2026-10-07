import {
  listNewArrivals,
  PRODUCT_CARD_MEDIA_FIELDS,
} from "@/lib/medusa/catalog"
import { getStorefrontSettings } from "@/lib/medusa/storefront-settings"
import { ProductList } from "@/components/catalog/product-list"
import { NEW_ARRIVALS_PATH } from "@/lib/seo/routes"
import Link from "next/link"

export async function NewArrivals() {
  const [settings, { products }] = await Promise.all([
    getStorefrontSettings(),
    listNewArrivals({ limit: 8, fields: PRODUCT_CARD_MEDIA_FIELDS }),
  ])

  return (
    <section className="py-12">
      <div className="container-wrapper px-5 sm:px-6 lg:px-12">
        <div className="flex items-end justify-between">
          <h2 className="text-2xl font-medium tracking-[-0.01em]">
            New Arrivals
          </h2>
          <Link
            href={NEW_ARRIVALS_PATH}
            className="text-[13px] font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            View all
          </Link>
        </div>
        <div className="mt-8">
          <ProductList
            products={products}
            newBadgeDays={settings.products.new_badge_days}
            gutter="default"
            showDetails
            showBadges
            badgePlacement="image"
            showWishlist
            showNotifyMe
          />
        </div>
      </div>
    </section>
  )
}
