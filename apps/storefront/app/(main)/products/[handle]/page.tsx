import type { Metadata } from "next"
import Image from "next/image"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { ProductList } from "@/components/catalog/product-list"
import { ProductView } from "@/components/product/product-view"
import { JsonLd } from "@/components/seo/json-ld"
import { fetchSizeGuideOnServer } from "@/features/size-guide/server"
import { getProductByHandle, listProducts } from "@/lib/medusa/catalog"
import { isNew } from "@/lib/medusa/product"
import { getStoreRegion } from "@/lib/medusa/region"
import { getStorefrontSettings } from "@/lib/medusa/storefront-settings"
import { productJsonLd } from "@/lib/seo/json-ld"
import { buildProductMetadata } from "@/lib/seo/metadata"

export async function generateMetadata({
  params,
}: PageProps<"/products/[handle]">): Promise<Metadata> {
  const product = await getProductByHandle((await params).handle)

  if (!product) {
    return {}
  }

  return buildProductMetadata(product, await getStorefrontSettings())
}

export default async function ProductPage({
  params,
}: PageProps<"/products/[handle]">) {
  const product = await getProductByHandle((await params).handle)

  if (!product) {
    notFound()
  }

  const categoryId = product.categories?.[0]?.id
  const [settings, region, sizeGuide, related] = await Promise.all([
    getStorefrontSettings(),
    getStoreRegion(),
    fetchSizeGuideOnServer(product.id),
    categoryId
      ? listProducts({ categoryId, limit: 5 })
      : Promise.resolve({ products: [] }),
  ])
  const alsoLike = related.products
    .filter((candidate) => candidate.id !== product.id)
    .slice(0, 4)

  return (
    <main className="container-wrapper px-5 pt-4 pb-24 sm:px-6 md:pt-8 lg:px-12">
      <JsonLd data={productJsonLd(product, region.currency_code, settings)} />

      <Suspense
        fallback={
          <div className="grid gap-8 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)]">
            <div className="relative aspect-3/4 bg-muted">
              {product.thumbnail && (
                <Image
                  src={product.thumbnail}
                  alt={product.title}
                  fill
                  priority
                  sizes="(min-width: 768px) 58vw, 100vw"
                  className="object-cover"
                />
              )}
            </div>
            <h1 className="text-2xl font-medium">{product.title}</h1>
          </div>
        }
      >
        <ProductView
          product={product}
          sizeGuide={sizeGuide.size_guide}
          isNew={isNew(product, settings.products.new_badge_days)}
          returns={settings.returns}
          supportEmail={settings.brand.support_email}
        />
      </Suspense>

      {alsoLike.length > 0 && (
        <section aria-labelledby="also-like" className="mt-24">
          <h2
            id="also-like"
            className="mb-8 text-2xl font-medium tracking-[-0.01em]"
          >
            You may also like
          </h2>
          <ProductList
            products={alsoLike}
            newBadgeDays={settings.products.new_badge_days}
            gutter="default"
            showDetails
            showBadges
            showWishlist
          />
        </section>
      )}
    </main>
  )
}
