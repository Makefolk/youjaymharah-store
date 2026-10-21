"use client"

import type { HttpTypes } from "@medusajs/types"
import {
  ArrowCounterClockwiseIcon,
  LockSimpleIcon,
  MinusIcon,
  PlusIcon,
  TruckIcon,
} from "@phosphor-icons/react"
import Image from "next/image"
import Link from "next/link"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  useAddToCart,
  useApplyPromoCode,
  useCart,
  useRemoveLineItem,
  useRemovePromoCode,
  useUpdateLineItem,
} from "@/features/cart/hooks"
import { useStorefrontSettings } from "@/features/site-settings/provider"
import { useSaveToWishlist, useWishlist } from "@/features/wishlist/hooks"
import {
  formatVariantTitle,
  getBagSummary,
  getLinePrice,
  MAX_LINE_QUANTITY,
} from "@/lib/medusa/bag"
import { formatPrice } from "@/lib/medusa/price"
import {
  CHECKOUT_PATH,
  NEW_ARRIVALS_PATH,
  productPath,
  WISHLIST_PATH,
} from "@/lib/seo/routes"
import { cn } from "@/lib/util/cn"

type Cart = HttpTypes.StoreCart
type Line = HttpTypes.StoreCartLineItem

const actionLink =
  "text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline disabled:pointer-events-none disabled:opacity-50"

/** What was just taken out, so it can be put back. */
type Removed = {
  title: string
  variantId: string
  quantity: number
  saved: boolean
}

export function BagView() {
  const { data: cart, isPending } = useCart()
  const [removed, setRemoved] = useState<Removed | null>(null)

  if (isPending) {
    return (
      <div className="mt-10 grid gap-6" aria-busy>
        {[0, 1].map((index) => (
          <div key={index} className="flex gap-5">
            <div className="aspect-4/5 w-24 animate-pulse bg-muted sm:w-32" />
            <div className="flex-1 space-y-3 pt-1">
              <div className="h-4 w-1/2 animate-pulse bg-muted" />
              <div className="h-3 w-1/4 animate-pulse bg-muted" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  const items = cart?.items ?? []

  return (
    <>
      {removed && <UndoBar removed={removed} onDone={() => setRemoved(null)} />}
      {cart && items.length ? (
        <FilledBag cart={cart} onRemoved={setRemoved} />
      ) : (
        <EmptyBag />
      )}
    </>
  )
}

function FilledBag({
  cart,
  onRemoved,
}: {
  cart: Cart
  onRemoved: (removed: Removed) => void
}) {
  const summary = getBagSummary(cart)
  const items = [...(cart.items ?? [])].sort(
    (a, b) =>
      new Date(a.created_at ?? 0).getTime() -
      new Date(b.created_at ?? 0).getTime(),
  )

  return (
    <div className="mt-8 grid gap-10 pb-28 lg:mt-10 lg:grid-cols-[minmax(0,1fr)_24rem] lg:gap-16 lg:pb-0">
      <section aria-label="Items in your bag">
        <ul className="border-t border-border">
          {items.map((item) => (
            <BagLine
              key={item.id}
              item={item}
              currencyCode={cart.currency_code}
              onRemoved={onRemoved}
            />
          ))}
        </ul>
      </section>

      <OrderSummary cart={cart} count={summary.count} />

      {/* Phones: the total and Checkout stay in reach. */}
      <div className="fixed inset-x-0 bottom-0 z-30 flex items-center gap-4 border-t border-border bg-background/95 px-5 py-3 backdrop-blur lg:hidden">
        <div className="min-w-0 flex-1 text-[13px]">
          <p className="text-muted-foreground">
            {summary.count} {summary.count === 1 ? "item" : "items"}
          </p>
          <p className="text-[15px] font-medium tabular-nums">
            {formatPrice(summary.total, cart.currency_code)}
          </p>
        </div>
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href={CHECKOUT_PATH} />}
          className="h-11 px-6 text-[12px] tracking-[0.06em] uppercase"
        >
          Checkout
        </Button>
      </div>
    </div>
  )
}

function BagLine({
  item,
  currencyCode,
  onRemoved,
}: {
  item: Line
  currencyCode: string
  onRemoved: (removed: Removed) => void
}) {
  const update = useUpdateLineItem()
  const remove = useRemoveLineItem()
  const save = useSaveToWishlist()
  const [problem, setProblem] = useState<string | null>(null)
  const quantity = Number(item.quantity ?? 1)
  const price = getLinePrice(item)
  const variant = formatVariantTitle(item.variant_title)
  const href = item.product_handle ? productPath(item.product_handle) : null
  const title = item.product_title ?? item.title
  const busy = remove.isPending || save.isPending

  const setQuantity = (next: number) => {
    setProblem(null)
    update.mutate(
      { lineItemId: item.id, quantity: next },
      {
        onError: (error) =>
          setProblem(
            /stock|inventory|quantity/i.test(error.message)
              ? "That's all we have in stock."
              : "Couldn't change the quantity. Please try again.",
          ),
      },
    )
  }

  const takeOut = async (saveForLater: boolean) => {
    setProblem(null)
    try {
      if (saveForLater && item.product_id) {
        await save.mutateAsync({
          product_id: item.product_id,
          variant_id: item.variant_id ?? null,
        })
      }
      await remove.mutateAsync(item.id)
      if (item.variant_id) {
        onRemoved({
          title,
          variantId: item.variant_id,
          quantity,
          saved: saveForLater,
        })
      }
    } catch {
      setProblem("Couldn't update your bag. Please try again.")
    }
  }

  const photo = (
    <div className="relative aspect-4/5 w-24 shrink-0 overflow-hidden bg-muted sm:w-32">
      {item.thumbnail && (
        <Image
          src={item.thumbnail}
          alt=""
          fill
          sizes="128px"
          className="object-cover transition-transform duration-500 group-hover:scale-[1.03] motion-reduce:transform-none"
        />
      )}
    </div>
  )

  return (
    <li
      className={cn(
        "flex gap-4 border-b border-border py-6 transition-opacity sm:gap-6",
        busy && "opacity-50",
      )}
    >
      {href ? (
        <Link href={href} className="group" tabIndex={-1} aria-hidden>
          {photo}
        </Link>
      ) : (
        photo
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {href ? (
              <Link
                href={href}
                className="text-[15px] leading-snug hover:underline hover:underline-offset-4"
              >
                {title}
              </Link>
            ) : (
              <p className="text-[15px] leading-snug">{title}</p>
            )}
            {variant && (
              <p className="mt-1 text-[13px] text-muted-foreground">
                {variant}
              </p>
            )}
            {quantity > 1 && (
              <p className="mt-1 text-[13px] text-muted-foreground tabular-nums">
                {formatPrice(Number(item.unit_price ?? 0), currencyCode)} each
              </p>
            )}
          </div>
          <div className="shrink-0 text-right text-[15px] tabular-nums">
            <p>{formatPrice(price.total, currencyCode)}</p>
            {price.compareAt !== null && (
              <s className="text-[13px] text-muted-foreground">
                {formatPrice(price.compareAt, currencyCode)}
              </s>
            )}
          </div>
        </div>

        <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-4">
          <div
            role="group"
            aria-label={`Quantity of ${title}`}
            className="flex h-9 items-center border border-border"
          >
            <button
              type="button"
              aria-label="Decrease quantity"
              disabled={quantity <= 1 || busy}
              onClick={() => setQuantity(quantity - 1)}
              className="flex h-full w-9 items-center justify-center transition-colors hover:bg-muted disabled:opacity-30"
            >
              <MinusIcon className="size-3.5" />
            </button>
            <span
              aria-live="polite"
              className="w-8 text-center text-[13px] tabular-nums"
            >
              {quantity}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              disabled={quantity >= MAX_LINE_QUANTITY || busy}
              onClick={() => setQuantity(quantity + 1)}
              className="flex h-full w-9 items-center justify-center transition-colors hover:bg-muted disabled:opacity-30"
            >
              <PlusIcon className="size-3.5" />
            </button>
          </div>
          <button
            type="button"
            disabled={busy || !item.product_id}
            onClick={() => void takeOut(true)}
            className={actionLink}
          >
            Save for later
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => void takeOut(false)}
            className={actionLink}
          >
            Remove
          </button>
        </div>
        {problem && (
          <p role="alert" className="mt-2 text-[13px] text-destructive">
            {problem}
          </p>
        )}
      </div>
    </li>
  )
}

function OrderSummary({ cart, count }: { cart: Cart; count: number }) {
  const settings = useStorefrontSettings()
  const summary = getBagSummary(cart)
  const codes = (cart.promotions ?? [])
    .filter((promotion) => promotion.code && !promotion.is_automatic)
    .map((promotion) => promotion.code as string)

  return (
    <aside
      aria-labelledby="bag-summary"
      className="lg:sticky lg:top-24 lg:self-start"
    >
      <div className="bg-muted/50 p-6 sm:p-8">
        <h2 id="bag-summary" className="text-[15px] font-medium">
          Order summary
        </h2>
        <dl className="mt-6 flex flex-col gap-3 text-[13px]">
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">
              Subtotal ({count} {count === 1 ? "item" : "items"})
            </dt>
            <dd className="tabular-nums">
              {formatPrice(summary.subtotal, cart.currency_code)}
            </dd>
          </div>
          {summary.discount > 0 && (
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Discount</dt>
              <dd className="tabular-nums">
                −{formatPrice(summary.discount, cart.currency_code)}
              </dd>
            </div>
          )}
          <div className="flex justify-between gap-4">
            <dt className="text-muted-foreground">Delivery</dt>
            <dd className="text-muted-foreground">Calculated at checkout</dd>
          </div>
          <div className="mt-2 flex justify-between gap-4 border-t border-border pt-4 text-[15px] font-medium">
            <dt>Total</dt>
            <dd className="tabular-nums">
              {formatPrice(summary.total, cart.currency_code)}
            </dd>
          </div>
        </dl>

        <PromoCode applied={codes} />

        <Button
          size="lg"
          nativeButton={false}
          render={<Link href={CHECKOUT_PATH} />}
          className="mt-6 h-12 w-full text-[13px] tracking-[0.06em] uppercase"
        >
          Checkout
        </Button>

        <ul className="mt-6 flex flex-col gap-3 text-[12px] text-muted-foreground">
          <li className="flex items-center gap-2.5">
            <LockSimpleIcon className="size-4 shrink-0" />
            Secure payment with Paystack or Credo
          </li>
          <li className="flex items-center gap-2.5">
            <TruckIcon className="size-4 shrink-0" />
            Delivery across Nigeria, options shown at checkout
          </li>
          {settings.returns.enabled && (
            <li className="flex items-center gap-2.5">
              <ArrowCounterClockwiseIcon className="size-4 shrink-0" />
              Returns within {settings.returns.window_days} days of delivery
            </li>
          )}
        </ul>
      </div>
      <Link
        href={NEW_ARRIVALS_PATH}
        className="mt-5 block text-center text-[13px] text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        Continue shopping
      </Link>
    </aside>
  )
}

function PromoCode({ applied }: { applied: string[] }) {
  const apply = useApplyPromoCode()
  const remove = useRemovePromoCode()
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState("")
  const [message, setMessage] = useState<string | null>(null)

  const submit = async () => {
    const value = code.trim()
    if (!value) return
    setMessage(null)
    try {
      const cart = await apply.mutateAsync(value)
      const used = (cart.promotions ?? []).some(
        (promotion) => promotion.code?.toLowerCase() === value.toLowerCase(),
      )
      if (used) {
        setCode("")
        setOpen(false)
      } else {
        setMessage("That code isn't valid for this bag.")
      }
    } catch {
      setMessage("That code isn't valid for this bag.")
    }
  }

  return (
    <div className="mt-5 border-t border-border pt-4 text-[13px]">
      {applied.map((value) => (
        <p key={value} className="mb-2 flex items-center justify-between gap-4">
          <span>
            Code <span className="font-medium uppercase">{value}</span> applied
          </span>
          <button
            type="button"
            disabled={remove.isPending}
            onClick={() => remove.mutate(value)}
            className={actionLink}
          >
            Remove
          </button>
        </p>
      ))}
      {open ? (
        <form
          className="mt-1 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <Input
            aria-label="Promo code"
            placeholder="Promo code"
            value={code}
            autoFocus
            autoCapitalize="characters"
            onChange={(event) => setCode(event.target.value)}
            className="h-10 bg-background uppercase"
          />
          <Button
            type="submit"
            variant="outline"
            disabled={apply.isPending || !code.trim()}
            className="h-10 px-4 text-[12px] tracking-[0.06em] uppercase"
          >
            {apply.isPending ? "…" : "Apply"}
          </Button>
        </form>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={actionLink}
        >
          Add a promo code
        </button>
      )}
      {message && (
        <p role="alert" className="mt-2 text-destructive">
          {message}
        </p>
      )}
    </div>
  )
}

function UndoBar({
  removed,
  onDone,
}: {
  removed: Removed
  onDone: () => void
}) {
  const add = useAddToCart()

  return (
    <div
      role="status"
      className="mt-6 flex animate-in items-center justify-between gap-4 border border-border px-4 py-3 text-[13px] duration-200 fade-in-0"
    >
      <span className="min-w-0">
        {removed.title} {removed.saved ? "saved for later" : "removed"}.
      </span>
      <span className="flex shrink-0 items-center gap-4">
        <button
          type="button"
          disabled={add.isPending}
          onClick={() =>
            add.mutate(
              { variantId: removed.variantId, quantity: removed.quantity },
              { onSuccess: onDone },
            )
          }
          className="font-medium underline underline-offset-4"
        >
          {add.isPending ? "Putting back…" : "Undo"}
        </button>
        <button
          type="button"
          aria-label="Dismiss"
          onClick={onDone}
          className="text-muted-foreground hover:text-foreground"
        >
          ×
        </button>
      </span>
    </div>
  )
}

function EmptyBag() {
  const wishlist = useWishlist()
  const saved = wishlist.data?.items?.length ?? 0

  return (
    <div className="mx-auto flex max-w-md flex-col items-center py-20 text-center sm:py-28">
      <p className="font-display text-display-md">Your bag is empty</p>
      <p className="mt-4 text-[15px] text-muted-foreground">
        Pieces you add will wait here until you&apos;re ready to check out.
      </p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href={NEW_ARRIVALS_PATH} />}
          className="h-12 px-8 text-[13px] tracking-[0.06em] uppercase"
        >
          Shop new arrivals
        </Button>
        {saved > 0 && (
          <Button
            variant="outline"
            size="lg"
            nativeButton={false}
            render={<Link href={WISHLIST_PATH} />}
            className="h-12 px-8 text-[13px] tracking-[0.06em] uppercase"
          >
            Your wishlist ({saved})
          </Button>
        )}
      </div>
    </div>
  )
}
