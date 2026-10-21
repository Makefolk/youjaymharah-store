"use client"

import type { HttpTypes } from "@medusajs/types"
import { PlusIcon } from "@phosphor-icons/react"
import { useState } from "react"

import { toast } from "@/components/ui/toaster"
import { useAddToCart } from "@/features/cart/hooks"
import type { QuickAdd } from "@/lib/medusa/product-card"
import { cn } from "@/lib/util/cn"

/**
 * Adds to the bag from the card. With one variant for the shown colour it
 * adds straight away; otherwise it lists the sizes and adds the one picked,
 * so a size is never chosen for the shopper. Hidden when nothing can be
 * added (coming soon, sold out).
 */
export function ProductCardQuickAdd({
  product,
  quickAdd,
}: {
  product: HttpTypes.StoreProduct
  /** From getQuickAdd; the card renders this only when something can be added. */
  quickAdd: QuickAdd
}) {
  const addToCart = useAddToCart()
  const [open, setOpen] = useState(false)
  const [pendingSize, setPendingSize] = useState<string | null>(null)
  function add(variantId: string, size: string | null) {
    setPendingSize(size)
    addToCart.mutate(
      { variantId },
      {
        onSuccess: () => {
          setOpen(false)
          toast.success("Added to your bag", {
            description: [product.title, quickAdd.colour, size]
              .filter(Boolean)
              .join(" · "),
            link: { href: "/shopping-bag", label: "View bag" },
          })
        },
        onError: () =>
          toast.error("Couldn't add to your bag", {
            description: "Please try again, or choose another size.",
          }),
        onSettled: () => setPendingSize(null),
      },
    )
  }

  return (
    <div
      className={cn(
        "absolute inset-x-0 bottom-0 z-20 transition-opacity",
        // Touch screens use the product page; the bar needs a hover to reveal.
        "hidden [@media(hover:hover)_and_(pointer:fine)]:block",
        open
          ? "opacity-100"
          : "opacity-0 group-focus-within/card:opacity-100 group-hover/card:opacity-100",
      )}
      onMouseLeave={() => setOpen(false)}
    >
      {quickAdd.mode === "sizes" && open ? (
        <div
          role="group"
          aria-label={`Choose a size of ${product.title} to add`}
          className="flex flex-wrap justify-center gap-x-1 gap-y-0.5 bg-background/95 px-2 py-2.5 backdrop-blur-sm"
        >
          {quickAdd.sizes.map((size) => (
            <button
              key={size.value}
              type="button"
              disabled={
                !size.available || !size.variantId || addToCart.isPending
              }
              aria-label={`Add size ${size.value}${size.available ? "" : " (sold out)"}`}
              onClick={() => add(size.variantId, size.value)}
              className={cn(
                "min-h-9 min-w-9 px-2 text-[12px] font-medium tabular-nums outline-offset-[-2px] hover:underline hover:underline-offset-4 focus-visible:outline-1 disabled:cursor-not-allowed disabled:text-muted-foreground disabled:line-through disabled:no-underline",
                pendingSize === size.value && "animate-pulse",
              )}
            >
              {size.value}
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          disabled={addToCart.isPending}
          aria-label={
            quickAdd.mode === "sizes"
              ? `Quick add ${product.title}: choose a size`
              : `Add ${product.title} to bag`
          }
          aria-expanded={quickAdd.mode === "sizes" ? open : undefined}
          onClick={() =>
            quickAdd.mode === "sizes"
              ? setOpen(true)
              : add(quickAdd.variantId, null)
          }
          className="flex h-11 w-full items-center justify-center gap-2 bg-background/95 text-[11px] font-medium tracking-[0.14em] uppercase outline-offset-[-2px] backdrop-blur-sm focus-visible:outline-1 disabled:cursor-wait"
        >
          <PlusIcon aria-hidden className="size-3.5" />
          {addToCart.isPending ? "Adding…" : "Quick add"}
        </button>
      )}
    </div>
  )
}
