"use client"

import Link from "next/link"
import { useState } from "react"

import type { CarouselApi } from "@/components/ui/carousel"
import { formatPrice, getProductPrice } from "@/lib/medusa/price"
import {
  getCardGallery,
  getCardStatus,
  getQuickAdd,
} from "@/lib/medusa/product-card"
import { getColourChoices } from "@/lib/medusa/variants"
import { productPath } from "@/lib/seo/routes"
import { cn } from "@/lib/util/cn"
import type { ProductCardProps } from "./product-card"
import { ProductCardControls } from "./product-card-controls"
import { ProductCardGallery } from "./product-card-gallery"
import { ProductCardQuickAdd } from "./product-card-quick-add"

export function ProductCardView({
  product,
  newProduct,
  quickView,
  showDetails = true,
  showQuickView = showDetails,
  detailsPlacement = "below",
  showPrice = true,
  showBadges = true,
  badgePlacement = "image",
  showWishlist = false,
  showQuickAdd = false,
  showNotifyMe = false,
  showColours = true,
  showCarouselArrows = true,
  showCarouselDots = true,
  inset = false,
  priority = false,
  sizes = "(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw",
}: Omit<ProductCardProps, "newBadgeDays"> & { newProduct: boolean }) {
  const [api, setApi] = useState<CarouselApi>()
  const gallery = getCardGallery(product)
  const price = showPrice || showBadges ? getProductPrice(product) : null
  const status = getCardStatus(product, newProduct)
  const productStatus = getCardStatus(product)
  const canNotify =
    productStatus === "Coming soon" || productStatus === "Sold out"
  // A sale shows as the percentage beside the price, not as a label.
  // One label, the most important status; a sale shows beside the price.
  const label = showBadges ? status : null
  const colours = showColours ? getColourChoices(product) : []
  const overlay = detailsPlacement === "overlay"
  const secondaryText = overlay ? "text-white/80" : "text-muted-foreground"
  const href = productPath(product.handle)
  const quickAdd = showQuickAdd && !overlay ? getQuickAdd(product, null) : null

  const details = (
    <div
      className={cn(
        !showDetails
          ? "sr-only"
          : overlay
            ? "absolute inset-x-0 bottom-0 bg-linear-to-t from-black/85 via-black/60 to-transparent pt-16 pr-4 pb-5 pl-12 text-white sm:pr-6 sm:pb-6"
            : "flex flex-1 flex-col pt-4 pb-7 sm:pt-5 sm:pb-9",
        showDetails && !overlay && inset && "px-4 sm:px-6",
      )}
    >
      <div className="flex flex-col gap-1.5 @xs/card:flex-row @xs/card:items-start @xs/card:justify-between @xs/card:gap-4">
        <h3 className="line-clamp-2 min-w-0 text-[14px] leading-snug font-medium sm:text-[15px]">
          <Link
            href={href}
            tabIndex={showDetails ? undefined : -1}
            className="outline-offset-4 focus-visible:outline-1"
          >
            {product.title}
          </Link>
        </h3>
        {showPrice && price && (
          <p
            className="flex shrink-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs leading-relaxed tabular-nums @xs/card:flex-col @xs/card:items-end"
            aria-live="polite"
          >
            <span>
              {price.price.isOnSale && (
                <span className="sr-only">Sale price: </span>
              )}
              {price.isRange && "From "}
              {formatPrice(price.price.amount, price.price.currencyCode)}
            </span>
            {price.price.isOnSale && (
              <span
                className={cn("flex items-baseline gap-1.5", secondaryText)}
              >
                <s>
                  <span className="sr-only">Original price: </span>
                  {formatPrice(
                    price.price.originalAmount,
                    price.price.currencyCode,
                  )}
                </s>
                <span>−{price.price.percentOff}%</span>
              </span>
            )}
          </p>
        )}
      </div>
      {badgePlacement === "details" && label && (
        <p
          className={cn(
            "mt-3 text-[10px] leading-relaxed tracking-[0.12em] uppercase",
            secondaryText,
          )}
        >
          {label}
        </p>
      )}
      {colours.length > 1 && (
        <p className={cn("mt-2 text-[11px]", secondaryText)}>
          {colours.length} colours
        </p>
      )}
    </div>
  )

  return (
    <article className="group/card @container/card relative isolate flex h-full min-w-0 flex-col">
      <div className="relative">
        <ProductCardGallery
          images={gallery}
          title={product.title}
          href={href}
          priority={priority}
          sizes={sizes}
          api={api}
          setApi={setApi}
          showArrows={showCarouselArrows}
          showDots={showCarouselDots}
          raiseLines={Boolean(quickAdd)}
        >
          {overlay && details}
        </ProductCardGallery>
        {badgePlacement === "image" && label && (
          <span className="pointer-events-none absolute top-3 left-3 bg-background/95 px-2 py-1 text-[10px] leading-relaxed tracking-[0.1em] text-foreground uppercase">
            {label}
          </span>
        )}
        {quickAdd && (
          <ProductCardQuickAdd product={product} quickAdd={quickAdd} />
        )}
        {(showWishlist || (showNotifyMe && canNotify)) && (
          <ProductCardControls
            productId={product.id}
            title={product.title}
            showWishlist={showWishlist}
            showNotifyMe={showNotifyMe && canNotify}
          />
        )}
      </div>
      {!overlay && details}
      {showQuickView && quickView}
    </article>
  )
}
