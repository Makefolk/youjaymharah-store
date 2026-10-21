"use client"

import Link from "next/link"

import { Button } from "@/components/ui/button"
import { useCart } from "@/features/cart/hooks"
import { formatPrice } from "@/lib/medusa/price"
import { CHECKOUT_PATH } from "@/lib/seo/routes"

/** Stub list of the cart's items; the cart id lives in the browser's cart cookie. */
export function CartContents() {
  const { data: cart, isPending } = useCart()

  if (isPending) {
    return (
      <p className="text-[15px] text-muted-foreground">Loading your bag…</p>
    )
  }

  const items = cart?.items ?? []

  if (!items.length) {
    return (
      <p className="text-[15px] text-muted-foreground">Your bag is empty.</p>
    )
  }

  return (
    <>
      <ul className="divide-y border-y">
        {items.map((item) => (
          <li key={item.id} className="flex justify-between gap-4 py-4">
            <span>
              <span className="block text-[15px]">
                {item.product_title ?? item.title}
              </span>
              {item.variant_title && (
                <span className="block text-[13px] text-muted-foreground">
                  {item.variant_title}
                </span>
              )}
              <span className="block text-[13px] text-muted-foreground">
                Qty {item.quantity}
              </span>
            </span>
            {cart && (
              <span className="text-[13px] tabular-nums">
                {formatPrice(
                  Number(item.unit_price) * Number(item.quantity),
                  cart.currency_code,
                )}
              </span>
            )}
          </li>
        ))}
      </ul>
      {cart && (
        <div className="mt-6 flex flex-col items-end gap-3">
          <p className="text-[15px]">
            Subtotal{" "}
            <span className="tabular-nums">
              {formatPrice(
                Number(cart.item_subtotal ?? cart.subtotal ?? 0),
                cart.currency_code,
              )}
            </span>
          </p>
          <p className="text-[13px] text-muted-foreground">
            Delivery is chosen at checkout.
          </p>
          <Button
            size="lg"
            nativeButton={false}
            render={<Link href={CHECKOUT_PATH} />}
            className="h-10 px-6 tracking-[0.06em] uppercase"
          >
            Checkout
          </Button>
        </div>
      )}
    </>
  )
}
