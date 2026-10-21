"use client"

import type { HttpTypes } from "@medusajs/types"
import { HeartIcon, ShareNetworkIcon } from "@phosphor-icons/react"
import Image from "next/image"
import Link from "next/link"
import { useRef, useState, type ReactNode } from "react"

import { Button } from "@/components/ui/button"
import { useAddToCart } from "@/features/cart/hooks"
import {
  useRemoveFromWishlist,
  useSaveToWishlist,
  useWishlistItem,
} from "@/features/wishlist/hooks"
import { formatPrice, getProductPrice } from "@/lib/medusa/price"
import {
  describeMissing,
  getPurchaseState,
  getStockMessage,
} from "@/lib/medusa/product-page"
import { shareProduct } from "@/lib/medusa/share-product"
import type { OptionSelection } from "@/lib/medusa/variants"
import { CHECKOUT_PATH, SHOPPING_BAG_PATH } from "@/lib/seo/routes"
import { cn } from "@/lib/util/cn"

import { NotifyMeButton } from "./notify-me-button"
import { ProductOptions } from "./product-options"
import { ProductStickyBar, stickyBarButtonClass } from "./product-sticky-bar"

const primaryClass = "h-12 w-full px-5 text-[13px] tracking-[0.06em] uppercase"

/**
 * Everything to choose and buy: price, options, the main button and what
 * happens after it. The main button is never disabled for a missing choice:
 * pressing it names what's missing, which is clearer than a greyed-out
 * button that gives no reason.
 */
export function ProductPurchase({
  product,
  selection,
  variant,
  onSelect,
  thumbnail,
  isNew,
  sizeGuide,
}: {
  product: HttpTypes.StoreProduct
  selection: OptionSelection
  variant: HttpTypes.StoreProductVariant | undefined
  onSelect: (title: string, value: string) => void
  thumbnail: string | null
  isNew: boolean
  sizeGuide: (selectedSize: string | null | undefined) => ReactNode
}) {
  const addToCart = useAddToCart()
  const [missing, setMissing] = useState<string[]>([])
  const [added, setAdded] = useState<HttpTypes.StoreProductVariant | null>(null)
  const buttonRef = useRef<HTMLDivElement>(null)

  const purchase = getPurchaseState(product, selection, variant)
  const price = getProductPrice(product, variant?.id)
  const stockMessage =
    purchase.action === "choose" ? null : getStockMessage(purchase.stock)

  const optionsRef = useRef<HTMLDivElement>(null)
  const chosen = (product.options ?? [])
    .map((option) => selection[option.title])
    .filter((value): value is string => Boolean(value))

  const backToOptions = () => {
    if (purchase.action === "choose") setMissing(purchase.missing)
    optionsRef.current?.scrollIntoView({ block: "center", behavior: "smooth" })
  }

  const select = (title: string, value: string) => {
    onSelect(title, value)
    setMissing((current) => current.filter((entry) => entry !== title))
    setAdded(null)
    addToCart.reset()
  }

  const add = () => {
    if (purchase.action === "choose") {
      setMissing(purchase.missing)
      document
        .querySelector(`[data-option="${purchase.missing[0]}"]`)
        ?.scrollIntoView({ block: "center", behavior: "smooth" })
      return
    }
    if (purchase.action !== "add" || !variant) return
    addToCart.mutate(
      { variantId: variant.id },
      { onSuccess: () => setAdded(variant) },
    )
  }

  const mainButton = (compact = false) =>
    purchase.action === "notify" ? (
      <NotifyMeButton
        productId={product.id}
        variantId={variant?.id ?? null}
        title={product.title}
        className={compact ? stickyBarButtonClass : primaryClass}
      />
    ) : (
      <Button
        size="lg"
        onClick={add}
        disabled={addToCart.isPending}
        aria-busy={addToCart.isPending || undefined}
        className={compact ? stickyBarButtonClass : primaryClass}
      >
        {addToCart.isPending ? "Adding…" : "Add to bag"}
      </Button>
    )

  return (
    <div className="flex flex-col gap-7">
      <div>
        {isNew && (
          <p className="mb-2 text-[12px] tracking-[0.06em] text-muted-foreground uppercase">
            New
          </p>
        )}
        <h1 className="text-2xl leading-tight font-medium tracking-[-0.01em] text-balance">
          {product.title}
        </h1>
        {product.subtitle && (
          <p className="mt-1 text-[15px] text-muted-foreground">
            {product.subtitle}
          </p>
        )}
        {price && <PriceLine price={price} />}
      </div>

      <div ref={optionsRef}>
        <ProductOptions
          product={product}
          selection={selection}
          onChange={select}
          missing={missing}
          sizeGuide={sizeGuide(selection.Size ?? selection.size)}
        />
      </div>

      <div className="flex flex-col gap-3">
        <div ref={buttonRef} className="flex gap-2">
          <div className="flex-1">{mainButton()}</div>
          <WishlistButton
            productId={product.id}
            variantId={variant?.id ?? null}
            title={product.title}
          />
        </div>
        {missing.length > 0 && (
          <p role="alert" className="text-[13px] text-destructive">
            {describeMissing(missing)} to add this to your bag.
          </p>
        )}
        {stockMessage && (
          <p
            className={cn(
              "text-[13px]",
              purchase.action === "add" && purchase.stock === "low_stock"
                ? "text-foreground"
                : "text-muted-foreground",
            )}
          >
            {stockMessage}
          </p>
        )}
        {addToCart.isError && (
          <p role="alert" className="text-[13px] text-destructive">
            {/stock|inventory|quantity/i.test(addToCart.error.message)
              ? "That size just sold out. Choose another, or ask to be notified."
              : "We couldn't add it to your bag. Please try again."}
          </p>
        )}
        {added && (
          <AddedToBag
            variant={added}
            title={product.title}
            thumbnail={thumbnail}
            onClose={() => setAdded(null)}
          />
        )}
      </div>

      <ShareButton product={product} />

      <ProductStickyBar
        anchor={buttonRef}
        thumbnail={thumbnail}
        title={product.title}
        chosen={chosen}
        missing={
          purchase.action === "choose"
            ? describeMissing(purchase.missing)
            : null
        }
        price={
          price
            ? formatPrice(price.price.amount, price.price.currencyCode)
            : null
        }
        action={mainButton(true)}
        wishlist={
          <WishlistButton
            productId={product.id}
            variantId={variant?.id ?? null}
            title={product.title}
            className="size-10"
          />
        }
        added={Boolean(added)}
        onChange={backToOptions}
      />
    </div>
  )
}

function PriceLine({
  price,
}: {
  price: NonNullable<ReturnType<typeof getProductPrice>>
}) {
  return (
    <p className="mt-3 flex items-baseline gap-2 text-[15px] tabular-nums">
      {price.isRange && <span className="text-muted-foreground">From</span>}
      <span>{formatPrice(price.price.amount, price.price.currencyCode)}</span>
      {price.price.isOnSale && (
        <>
          <s className="text-muted-foreground">
            {formatPrice(price.price.originalAmount, price.price.currencyCode)}
          </s>
          <span className="text-[13px] text-muted-foreground">
            {price.price.percentOff}% off
          </span>
        </>
      )}
    </p>
  )
}

function WishlistButton({
  productId,
  variantId,
  title,
  className,
}: {
  productId: string
  variantId: string | null
  title: string
  className?: string
}) {
  const { item, isSaved, isPending } = useWishlistItem(productId)
  const save = useSaveToWishlist()
  const remove = useRemoveFromWishlist()
  const busy = isPending || save.isPending || remove.isPending

  return (
    <button
      type="button"
      aria-pressed={isSaved}
      aria-label={`${isSaved ? "Remove" : "Save"} ${title} ${isSaved ? "from" : "to"} your wishlist`}
      title={isSaved ? "Saved to your wishlist" : "Save to your wishlist"}
      disabled={busy}
      onClick={() =>
        item
          ? remove.mutate(item)
          : save.mutate({ product_id: productId, variant_id: variantId })
      }
      className={cn(
        "flex size-12 shrink-0 items-center justify-center border border-border transition-colors hover:border-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-foreground disabled:cursor-wait",
        className,
      )}
    >
      <HeartIcon className="size-5" weight={isSaved ? "fill" : "regular"} />
    </button>
  )
}

function AddedToBag({
  variant,
  title,
  thumbnail,
  onClose,
}: {
  variant: HttpTypes.StoreProductVariant
  title: string
  thumbnail: string | null
  onClose: () => void
}) {
  return (
    <div
      role="status"
      className="flex animate-in flex-col gap-4 border border-border p-4 duration-200 fade-in-0 slide-in-from-top-1"
    >
      <div className="flex items-start gap-3">
        {thumbnail ? (
          <Image
            src={thumbnail}
            alt=""
            width={48}
            height={60}
            className="aspect-4/5 w-12 shrink-0 bg-muted object-cover"
          />
        ) : null}
        <div className="min-w-0 flex-1 text-[13px]">
          <p className="font-medium">Added to your bag</p>
          <p className="mt-1 text-muted-foreground">
            {title}
            {variant.title ? ` · ${variant.title}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Close
        </button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="outline"
          size="lg"
          nativeButton={false}
          render={<Link href={SHOPPING_BAG_PATH} />}
          className="h-10 text-[12px] tracking-[0.06em] uppercase"
        >
          View bag
        </Button>
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href={CHECKOUT_PATH} />}
          className="h-10 text-[12px] tracking-[0.06em] uppercase"
        >
          Checkout
        </Button>
      </div>
    </div>
  )
}

function ShareButton({
  product,
}: {
  product: Pick<HttpTypes.StoreProduct, "title" | "handle">
}) {
  const [message, setMessage] = useState("")

  return (
    <div className="flex items-center gap-3 text-[13px]">
      <button
        type="button"
        onClick={async () => {
          setMessage("")
          try {
            const result = await shareProduct(product)
            if (result.status === "copied") setMessage("Link copied")
            if (result.status === "unavailable") setMessage(result.url)
          } catch {
            setMessage("Couldn't share. Copy the address from your browser.")
          }
        }}
        className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground"
      >
        <ShareNetworkIcon className="size-4" />
        Share
      </button>
      <span role="status" className="text-muted-foreground">
        {message}
      </span>
    </div>
  )
}
