import type { HttpTypes } from "@medusajs/types"
import Image from "next/image"
import Link from "next/link"

import { formatPrice, getProductPrice } from "@/lib/medusa/price"
import { isNew } from "@/lib/medusa/product"
import { productPath } from "@/lib/seo/routes"

/**
 * Stub product grid for the listing pages: image, name and price. Replace with
 * the designed product card.
 */
export function ProductList({
  products,
  newBadgeDays,
}: {
  products: HttpTypes.StoreProduct[]
  newBadgeDays?: number
}) {
  if (!products.length) {
    return (
      <p className="text-[15px] text-muted-foreground">
        Nothing here yet. Check back soon.
      </p>
    )
  }

  return (
    <ul className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
      {products.map((product) => {
        const price = getProductPrice(product)
        const isNewProduct = newBadgeDays != null && isNew(product, newBadgeDays)

        return (
          <li key={product.id}>
            <Link href={productPath(product.handle)} className="group block">
              <span className="relative block aspect-3/4 overflow-hidden bg-muted">
                {product.thumbnail && (
                  <Image
                    src={product.thumbnail}
                    alt={product.title}
                    fill
                    sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
                    className="object-cover"
                  />
                )}
              </span>
              <span className="mt-3 block text-[15px]">
                {isNewProduct && (
                  <span className="mr-2 text-[11px] font-medium uppercase tracking-wider text-primary">
                    New
                  </span>
                )}
                {product.title}
              </span>
              {price && (
                <span className="mt-1 flex gap-2 text-[13px] tabular-nums">
                  <span>
                    {price.isRange && "From "}
                    {formatPrice(price.price.amount, price.price.currencyCode)}
                  </span>
                  {price.price.isOnSale && (
                    <s className="text-muted-foreground">
                      {formatPrice(
                        price.price.originalAmount,
                        price.price.currencyCode,
                      )}
                    </s>
                  )}
                </span>
              )}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
