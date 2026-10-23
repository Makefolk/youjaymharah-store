import type { HttpTypes } from "@medusajs/types"
import {
  ProductCard,
  type ProductCardProps,
} from "@/components/catalog/product-card"
import { cn } from "@/lib/util/cn"

type CardOptions = Pick<
  ProductCardProps,
  | "showDetails"
  | "detailsPlacement"
  | "showPrice"
  | "showBadges"
  | "badgePlacement"
  | "showWishlist"
  | "showNotifyMe"
  | "showColours"
  | "showCarouselArrows"
  | "showCarouselDots"
  | "sizes"
>

/** How many cards load eagerly: the first row at the widest breakpoint. */
const PRIORITY_CARDS = 4

/**
 * Shared listing grid. `gutter="none"` butts the photos edge to edge and
 * insets each card's details instead; pair it with a full-bleed container.
 */
export function ProductList({
  products,
  newBadgeDays,
  gutter = "default",
  priority = false,
  ...cardOptions
}: {
  products: HttpTypes.StoreProduct[]
  newBadgeDays?: number
  gutter?: "default" | "none"
  /** Eager-load the first row; set it when the grid sits above the fold. */
  priority?: boolean
} & CardOptions) {
  if (!products.length) {
    return (
      <p className="text-[15px] text-muted-foreground">
        Nothing here yet. Check back soon.
      </p>
    )
  }

  const gapless = gutter === "none"

  return (
    <ul
      className={cn(
        "grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4",
        !gapless && "gap-x-3 gap-y-6 sm:gap-x-5 lg:gap-x-6",
      )}
    >
      {products.map((product, index) => (
        <li key={product.id} className="min-w-0">
          <ProductCard
            product={product}
            newBadgeDays={newBadgeDays}
            inset={gapless}
            priority={priority && index < PRIORITY_CARDS}
            {...cardOptions}
          />
        </li>
      ))}
    </ul>
  )
}
