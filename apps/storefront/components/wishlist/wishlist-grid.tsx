"use client"

import type { HttpTypes } from "@medusajs/types"
import Link from "next/link"
import { useState } from "react"

import { ProductCard } from "@/components/catalog/product-card"
import { Button } from "@/components/ui/button"
import { toast } from "@/components/ui/toaster"
import { useAddToCart } from "@/features/cart/hooks"
import { useWishlist } from "@/features/wishlist/hooks"
import { getQuickAdd } from "@/lib/medusa/product-card"
import { NEW_ARRIVALS_PATH, SHOPPING_BAG_PATH } from "@/lib/seo/routes"
import { cn } from "@/lib/util/cn"

/**
 * Saved products, each with its size choice and "Add to bag" always shown:
 * the card's quick add needs a hover, which phones don't have. Removing one
 * (the heart) takes it off the page straight away.
 */
export function WishlistGrid({
  products,
  newBadgeDays,
}: {
  products: HttpTypes.StoreProduct[]
  newBadgeDays: number
}) {
  const wishlist = useWishlist()
  const saved = wishlist.data
    ? new Set(wishlist.data.items.map((item) => item.product_id))
    : null
  const shown = saved
    ? products.filter((product) => saved.has(product.id))
    : products

  if (!shown.length) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center text-[15px] text-muted-foreground">
        <p>Nothing saved yet. Tap the heart on any piece to keep it here.</p>
        <Link
          href={NEW_ARRIVALS_PATH}
          className="mt-4 inline-block text-foreground underline underline-offset-4"
        >
          See new arrivals
        </Link>
      </div>
    )
  }

  return (
    <>
      <p className="mt-3 px-5 text-center text-[13px] text-muted-foreground sm:px-6">
        {shown.length} {shown.length === 1 ? "piece" : "pieces"}
      </p>
      <ul className="mt-8 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
        {shown.map((product, index) => (
          <li key={product.id} className="flex min-w-0 flex-col">
            <ProductCard
              product={product}
              newBadgeDays={newBadgeDays}
              inset
              priority={index < 4}
              showWishlist
              showNotifyMe
              sizes="(min-width: 1024px) 25vw, (min-width: 768px) 33vw, 50vw"
            />
            <AddToBag product={product} />
          </li>
        ))}
      </ul>
    </>
  )
}

function AddToBag({ product }: { product: HttpTypes.StoreProduct }) {
  const addToCart = useAddToCart()
  const quickAdd = getQuickAdd(product, null)
  const [variantId, setVariantId] = useState("")

  if (!quickAdd) return null

  const chosen =
    quickAdd.mode === "direct"
      ? { variantId: quickAdd.variantId, size: null }
      : (() => {
          const size = quickAdd.sizes.find((s) => s.variantId === variantId)
          return size ? { variantId: size.variantId, size: size.value } : null
        })()

  const add = () => {
    if (!chosen) return
    addToCart.mutate(
      { variantId: chosen.variantId },
      {
        onSuccess: () =>
          toast.success("Added to your bag", {
            description: [product.title, chosen.size]
              .filter(Boolean)
              .join(" · "),
            link: { href: SHOPPING_BAG_PATH, label: "View bag" },
          }),
        onError: () =>
          toast.error("Couldn't add to your bag", {
            description: "Please try again, or choose another size.",
          }),
      },
    )
  }

  return (
    <div className="mt-auto flex flex-col gap-2 px-4 pb-8 sm:px-6">
      {quickAdd.mode === "sizes" && (
        <div
          role="radiogroup"
          aria-label={`Size of ${product.title}`}
          className="flex flex-wrap gap-1"
        >
          {quickAdd.sizes.map((size) => (
            <button
              key={size.value}
              type="button"
              role="radio"
              aria-checked={variantId === size.variantId}
              disabled={!size.available}
              onClick={() => setVariantId(size.variantId)}
              className={cn(
                "min-h-9 min-w-9 border px-2 text-[12px] tabular-nums outline-offset-2 focus-visible:outline-1 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:line-through",
                variantId === size.variantId
                  ? "border-foreground"
                  : "border-border hover:border-foreground/40",
              )}
            >
              {size.value}
            </button>
          ))}
        </div>
      )}
      <Button
        size="lg"
        variant="outline"
        disabled={!chosen || addToCart.isPending}
        onClick={add}
        className="h-10 tracking-[0.06em] uppercase"
      >
        {addToCart.isPending
          ? "Adding…"
          : chosen
            ? "Add to bag"
            : "Choose a size"}
      </Button>
    </div>
  )
}
