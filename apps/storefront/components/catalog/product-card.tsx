import type { HttpTypes } from "@medusajs/types"
import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"

import { formatPrice, getProductPrice } from "@/lib/medusa/price"
import { isNew } from "@/lib/medusa/product"
import { productPath } from "@/lib/seo/routes"

export type ProductCardProps = {
  /** Use listProducts/listNewArrivals/searchProducts for region-priced data. */
  product: HttpTypes.StoreProduct
  /** settings.products.new_badge_days; omit to hide the New badge. */
  newBadgeDays?: number
  /**
   * Reserved for the quick-view trigger. The dialog/drawer and intercepted
   * route are not implemented yet; omit this slot until they are wired up.
   * It sits outside the product link so interactive controls are not nested.
   */
  quickView?: ReactNode
}

/**
 * Bare product card: photo, title, New badge and price. Render on the server
 * so isNew uses the server clock. Interactive features belong in small Client
 * Components, supplied through slots such as quickView.
 *
 * Control visibility contract (to implement alongside the controls): callers
 * must be able to hide any control, or any combination, independently via
 * props. Expose optional booleans such as showQuickView, showWishlist,
 * showQuickAdd, showNotifyMe, showShare, showColourSelector, showSizeSelector,
 * showCarouselArrows and showCarouselDots. Every future control must also
 * have a visibility prop; do not limit callers to fixed card presets.
 * For example, showShare={false} and showNotifyMe={false} hide only those two
 * controls. Omitted props retain the default behavior; true still respects
 * product availability and feature eligibility. false omits the control
 * from the DOM/tab order, its empty layout space and any requests needed
 * solely by it. showQuickView={false} must also suppress a supplied quickView
 * slot. Hiding carousel arrows/dots must not disable swipe gestures. Hiding
 * option selectors must never silently choose a size for quick add. These
 * boolean props are a documented requirement, not implemented in this stub.
 *
 * Backend-supported presentation and extension points:
 *
 * - Identity: id for actions, title for the label, handle for productPath.
 *   PRODUCT_CARD_FIELDS in lib/medusa/catalog supplies the baseline payload.
 * - Photos: thumbnail, with a first-gallery-image fallback when images were
 *   fetched. Hover photos/galleries need *images; colour-specific photos need
 *   *variants.images (and +variants.thumbnail for variant thumbnails). Use
 *   getSelectionImages from lib/medusa/variants after choosing options. Keep
 *   the image frame when no photo exists; size images for their actual grid.
 * - Swipe carousel (stub): request PRODUCT_CARD_MEDIA_FIELDS via listProducts
 *   or listNewArrivals' fields; searchProducts currently uses baseline fields
 *   and must opt into the media preset when its cards gain a carousel. Use
 *   getProductCardImages from lib/medusa/variants for thumbnail-first slides
 *   without repeated URLs, and components/ui/carousel for touch/drag plus
 *   keyboard/previous/next controls. Keep the gallery and its controls outside
 *   the title link, suppress link activation after dragging, lazy-load photos
 *   and reset to the first slide when the colour changes. No detail view is
 *   needed to swipe; a single photo needs no carousel controls or autoplay.
 * - Price: getProductPrice returns the cheapest priced variant and isRange
 *   for a "From" prefix; pass a chosen variant id for its exact price.
 *   formatPrice uses Medusa amounts as-is, without dividing by 100. A sale
 *   price list exposes originalAmount and percentOff; override price lists
 *   do not earn a sale badge. Missing price means omit it, not "Free". Needs
 *   region_id and *variants.calculated_price, supplied by catalogue reads.
 * - Badges: isNew uses new_badge_days and metadata.launched_at/created_at;
 *   isComingSoon reads metadata.coming_soon and suppresses New. Both helpers
 *   live in lib/medusa/product. Sale/% off comes from the displayed price,
 *   not an unrelated variant. Collection/tag labels need *collection/*tags;
 *   a merchandising tag is not evidence of measured sales or popularity.
 * - Availability: getVariantStock/isVariantPurchasable in lib/medusa/variants
 *   account for tracked inventory, backorders and coming soon. A product is
 *   sold out only when none of its variants can be bought; a sold-out size
 *   does not make the whole product sold out. Inventory must be fetched:
 *   missing stock fields are not proof of no stock. Low-stock copy is for a
 *   selected variant, not the sum of all sizes/colours. Cached availability
 *   is advisory; the cart API validates purchases.
 *   Show "Coming soon" before stock messaging; otherwise "Out of stock" when
 *   every variant is unavailable. A backorderable variant is still buyable.
 * - Options: getColourChoices/getSizeChoices/getOptionChoices expose values
 *   in admin order and availability, with metadata.hex/swatch_image for colour
 *   or print swatches. Derive values from variants, not shared option.values.
 *   PRODUCT_CARD_FIELDS includes options, variant options and stock fields.
 *   Keep unavailable choices visible; use text when no swatch is configured.
 *   Card switching should keep OptionSelection in local component state,
 *   not useProductSelection's page-wide URL params (which would couple every
 *   card in the grid). Resolve the variant with findVariant, refresh its
 *   price/stock and pass the same selection to getProductCardImages. Its
 *   cover prefers variant thumbnail, then variant gallery, then product media.
 * - Wishlist: useWishlistItem/useSaveToWishlist/useRemoveFromWishlist in
 *   features/wishlist/hooks support guests and customers. Save product_id and
 *   optionally variant_id; disable the heart while that product is pending.
 * - Quick add: useProductSelection (inside Suspense) or findVariant resolves
 *   a complete choice. useAddToCart in features/cart/hooks takes variantId
 *   and quantity. Require a priced, purchasable variant; never silently pick
 *   a shopper's size. Show pending/error states and use quick view for choices.
 * - Notify me: useCreateProductAlert in features/product-alerts/hooks supports
 *   coming-soon products and sold-out variants. Guests supply an email;
 *   customers use their account email. useWaitingProductAlert supplies the
 *   customer's saved alert state. Marketing consent is a separate opt-in.
 *   Bell button flow (stub): guests open a small email form, with no forced
 *   signup. Signed-in customers enable the alert in one click, without an
 *   email form. Wait for useCustomer to resolve before choosing that flow.
 *   After the API succeeds, announce "We'll email you when it's available"
 *   in a live status message; disable while pending and show errors on failure.
 *   Coming-soon alerts can use product_id alone; for a particular sold-out
 *   size/colour include variant_id after selection. A product-wide restock
 *   alert means any variant becoming available, not a particular size.
 *   A signed-in customer's active bell can cancel via useCancelProductAlert.
 *   Guests receive no alert record from the API: show session success without
 *   claiming their subscription can be looked up or toggled off anonymously.
 * - Share button (stub): call shareProduct from lib/medusa/share-product
 *   directly on click for native sharing, with copy-link/manual-copy fallbacks.
 *   Give the icon an accessible "Share [product title]" label. Keep it outside
 *   product links, disable during sharing, announce only confirmed copy
 *   success, ignore cancellation, and show a retry on other errors. Share the
 *   product's URL so recipients land on the full page, not a listing overlay.
 * - More detail in quick view: getProductByHandle fetches PRODUCT_PAGE_FIELDS
 *   for subtitle, description, material, images, categories, collection and
 *   tags. Optional metadata.fit/care is seeded by this backend; read it with
 *   metaText from lib/medusa/metadata. Fetch the resolved size guide separately
 *   with sizeGuideQueries.forProduct or fetchSizeGuideOnServer; hide its link
 *   when size_guide is null. lib/medusa/size-guide formats measurements.
 * - Ratings/review counts, delivery estimates and "X people viewing" have no
 *   product-card data source here. Do not invent them from product metadata.
 *
 * Quick-view routing contract (stub): use an intercepted /products/[handle]
 * route, not a persistent query-param modal. A button-styled Link with
 * scroll={false} opens a Dialog (or Drawer) over the current listing. Create
 * app/(main)/@quickView/(.)products/[handle]/page.tsx, render that parallel
 * slot in the main layout, and provide null default.tsx and [[...catchAll]]
 * page.tsx fallbacks so navigation away, including home, clears the overlay.
 * Fetch full detail only there, not for every card. Close/Escape calls
 * router.back(); Back closes and Forward reopens. Refresh, a new tab or a
 * fresh visit renders the existing full product page at the same URL.
 * Interception applies to ALL soft links to that route: to keep image/title
 * and "View full details" links opening a full page, use hard navigation for
 * those when wiring this up. Give the overlay an accessible title, trap focus
 * and return focus to its trigger. No route or modal behavior is active yet.
 */
export function ProductCard({
  product,
  newBadgeDays,
  quickView,
}: ProductCardProps) {
  const price = getProductPrice(product)
  const isNewProduct = newBadgeDays != null && isNew(product, newBadgeDays)
  const image = product.thumbnail || product.images?.[0]?.url

  return (
    <article>
      <Link href={productPath(product.handle)} className="group block">
        <span className="relative block aspect-3/4 overflow-hidden bg-muted">
          {image && (
            <Image
              src={image}
              alt={product.title}
              fill
              sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
              className="object-cover"
            />
          )}
        </span>
        <h3 className="mt-3 text-[15px]">
          {isNewProduct && (
            <span className="mr-2 text-[11px] font-medium tracking-wider text-primary uppercase">
              New
            </span>
          )}
          {product.title}
        </h3>
        {price && (
          <p className="mt-1 flex gap-2 text-[13px] tabular-nums">
            <span>
              {price.isRange && "From "}
              {formatPrice(price.price.amount, price.price.currencyCode)}
            </span>
            {price.price.isOnSale && (
              <s className="text-muted-foreground">
                <span className="sr-only">Original price: </span>
                {formatPrice(
                  price.price.originalAmount,
                  price.price.currencyCode,
                )}
              </s>
            )}
          </p>
        )}
      </Link>
      {quickView}
    </article>
  )
}
