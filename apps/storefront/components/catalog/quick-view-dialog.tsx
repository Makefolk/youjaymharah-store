"use client"

import type { HttpTypes } from "@medusajs/types"
import Image from "next/image"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"

import { primaryButtonClass } from "@/components/account/account-shell"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/components/ui/toaster"
import { useAddToCart } from "@/features/cart/hooks"
import { formatPrice, getProductPrice } from "@/lib/medusa/price"
import {
  COLOUR_OPTION,
  findVariant,
  getColourChoices,
  getProductCardImages,
  getSizeChoices,
  isVariantPurchasable,
  SIZE_OPTION,
  type OptionSelection,
} from "@/lib/medusa/variants"
import { productPath, SHOPPING_BAG_PATH } from "@/lib/seo/routes"
import { cn } from "@/lib/util/cn"

/**
 * A product over the listing: photos, price, colour and size, add to bag.
 * Closing goes back, so the browser's Back and Forward close and reopen it.
 * "View full details" is a plain link: the quick view route is the only one
 * intercepted, so it opens the real page.
 */
export function QuickViewDialog({
  product,
}: {
  product: HttpTypes.StoreProduct
}) {
  const router = useRouter()
  const addToCart = useAddToCart()
  const colours = getColourChoices(product)
  const [selection, setSelection] = useState<OptionSelection>(() => ({
    [COLOUR_OPTION]:
      colours.find((c) => c.available)?.value ?? colours[0]?.value,
  }))
  const sizes = getSizeChoices(product, selection)
  const variant = findVariant(product, selection)
  const images = getProductCardImages(product, selection)
  const price = getProductPrice(product, variant?.id)
  const needsSize = sizes.length > 0 && !selection[SIZE_OPTION]
  const buyable = variant ? isVariantPurchasable(variant, product) : false

  const add = () => {
    if (!variant) return
    addToCart.mutate(
      { variantId: variant.id },
      {
        onSuccess: () => {
          toast.success("Added to your bag", {
            description: [
              product.title,
              selection[COLOUR_OPTION],
              selection[SIZE_OPTION],
            ]
              .filter(Boolean)
              .join(" · "),
            link: { href: SHOPPING_BAG_PATH, label: "View bag" },
          })
          router.back()
        },
        onError: () =>
          toast.error("Couldn't add to your bag", {
            description: "Please try again, or choose another size.",
          }),
      },
    )
  }

  return (
    <Dialog defaultOpen onOpenChange={(open) => !open && router.back()}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-3xl sm:p-0">
        <div className="grid sm:grid-cols-2">
          <div className="flex snap-x snap-mandatory [scrollbar-width:none] overflow-x-auto bg-muted sm:max-h-[80dvh] sm:flex-col sm:overflow-x-hidden sm:overflow-y-auto">
            {(images.length ? images : [{ id: "none", url: "" }]).map(
              (image, index) => (
                <div
                  key={image.id + image.url}
                  className="relative aspect-3/4 w-full shrink-0 snap-start"
                >
                  {image.url && (
                    <Image
                      src={image.url}
                      alt={`${product.title}, photo ${index + 1}`}
                      fill
                      sizes="(min-width: 640px) 384px, 100vw"
                      priority={index === 0}
                      className="object-cover"
                    />
                  )}
                </div>
              ),
            )}
          </div>
          <div className="flex flex-col gap-6 p-6 sm:p-8">
            <div>
              <DialogTitle className="font-sans text-xl font-medium">
                {product.title}
              </DialogTitle>
              {price && (
                <DialogDescription className="mt-2 flex items-baseline gap-2 text-[15px] text-foreground tabular-nums">
                  <span>
                    {price.isRange && !variant ? "From " : ""}
                    {formatPrice(price.price.amount, price.price.currencyCode)}
                  </span>
                  {price.price.isOnSale && (
                    <s className="text-[13px] text-muted-foreground">
                      {formatPrice(
                        price.price.originalAmount,
                        price.price.currencyCode,
                      )}
                    </s>
                  )}
                </DialogDescription>
              )}
            </div>

            {colours.length > 1 && (
              <Choices
                label={`Colour: ${selection[COLOUR_OPTION] ?? ""}`}
                choices={colours}
                chosen={selection[COLOUR_OPTION]}
                onChoose={(value) =>
                  setSelection({
                    [COLOUR_OPTION]: value,
                    [SIZE_OPTION]: undefined,
                  })
                }
              />
            )}
            {sizes.length > 0 && (
              <Choices
                label="Size"
                choices={sizes}
                chosen={selection[SIZE_OPTION]}
                onChoose={(value) =>
                  setSelection((current) => ({
                    ...current,
                    [SIZE_OPTION]: value,
                  }))
                }
              />
            )}

            <Button
              size="lg"
              disabled={needsSize || !buyable || addToCart.isPending}
              onClick={add}
              className={primaryButtonClass}
            >
              {addToCart.isPending
                ? "Adding…"
                : needsSize
                  ? "Choose a size"
                  : buyable
                    ? "Add to bag"
                    : "Sold out"}
            </Button>
            <Link
              href={productPath(product.handle)}
              className="text-[13px] underline underline-offset-4"
            >
              View full details
            </Link>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Choices({
  label,
  choices,
  chosen,
  onChoose,
}: {
  label: string
  choices: { value: string; available: boolean }[]
  chosen: string | null | undefined
  onChoose: (value: string) => void
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-2">
      <span className="text-[13px] font-medium">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {choices.map((choice) => (
          <button
            key={choice.value}
            type="button"
            role="radio"
            aria-checked={chosen === choice.value}
            onClick={() => onChoose(choice.value)}
            className={cn(
              "min-h-9 min-w-10 border px-3 text-[13px]",
              chosen === choice.value
                ? "border-foreground"
                : "border-border hover:border-foreground/40",
              !choice.available && "text-muted-foreground line-through",
            )}
          >
            {choice.value}
          </button>
        ))}
      </div>
    </div>
  )
}
