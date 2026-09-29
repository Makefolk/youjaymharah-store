import type { HttpTypes } from "@medusajs/types"
import { ProductCard } from "@/components/catalog/product-card"

/**
 * Shared listing grid. ProductCard owns presentation and documents the
 * backend-supported features available for the eventual card design.
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
      {products.map((product) => (
        <li key={product.id}>
          <ProductCard product={product} newBadgeDays={newBadgeDays} />
        </li>
      ))}
    </ul>
  )
}
