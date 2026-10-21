"use client"

import { BellIcon, HeartIcon } from "@phosphor-icons/react"
import { useId, useState } from "react"

import { toast } from "@/components/ui/toaster"
import { cn } from "@/lib/util/cn"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useCustomer } from "@/features/customer/hooks"
import {
  useCancelProductAlert,
  useCreateProductAlert,
  useProductAlerts,
} from "@/features/product-alerts/hooks"
import {
  useRemoveFromWishlist,
  useSaveToWishlist,
  useWishlist,
  useWishlistItem,
} from "@/features/wishlist/hooks"

type ProductIdentity = { productId: string; title: string }

/** No background, so the photo stays clear; the shadow keeps it visible on light photos. */
const controlClass =
  "flex size-11 items-center justify-center text-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.45)] transition-opacity focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:cursor-wait"

/**
 * Shown on hover for mouse users and always on touch screens; always shown
 * once on (saved, subscribed), so the state can be seen at a glance.
 */
const hoverOnly =
  "[@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-hover/card:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-focus-within/card:opacity-100"

export function ProductCardControls({
  productId,
  title,
  showWishlist,
  showNotifyMe,
}: ProductIdentity & { showWishlist: boolean; showNotifyMe: boolean }) {
  return (
    <div className="absolute top-2 right-2 flex flex-col gap-1">
      {showWishlist && <WishlistControl productId={productId} title={title} />}
      {showNotifyMe && <NotifyControl productId={productId} title={title} />}
    </div>
  )
}

function WishlistControl({ productId, title }: ProductIdentity) {
  const wishlist = useWishlist()
  const { item, isSaved, isPending } = useWishlistItem(productId)
  const save = useSaveToWishlist()
  const remove = useRemoveFromWishlist()
  const label = wishlist.isError
    ? "Retry loading wishlist"
    : `${isSaved ? "Remove" : "Save"} ${title} ${isSaved ? "from" : "to"} wishlist`

  async function toggle() {
    if (wishlist.isError) {
      await wishlist.refetch()
      return
    }
    try {
      if (item) {
        await remove.mutateAsync(item)
        toast.info("Removed from your wishlist", { description: title })
      } else {
        await save.mutateAsync({ product_id: productId })
        toast.success("Saved to your wishlist", {
          description: title,
          link: { href: "/wishlist", label: "View wishlist" },
        })
      }
    } catch {
      toast.error("Couldn't update your wishlist", {
        description: "Please try again.",
      })
    }
  }

  return (
    <button
      type="button"
      className={cn(controlClass, !isSaved && hoverOnly)}
      aria-label={label}
      title={label}
      aria-pressed={isSaved}
      disabled={
        wishlist.isPending || isPending || save.isPending || remove.isPending
      }
      onClick={toggle}
    >
      <HeartIcon
        aria-hidden
        className={cn("size-5", isSaved && "text-gold")}
        weight={isSaved ? "fill" : "regular"}
      />
    </button>
  )
}

function NotifyControl({ productId, title }: ProductIdentity) {
  const customer = useCustomer()
  const alerts = useProductAlerts()
  const create = useCreateProductAlert()
  const cancel = useCancelProductAlert()
  const emailId = useId()
  const [message, setMessage] = useState("")
  const [failed, setFailed] = useState(false)
  const [open, setOpen] = useState(false)
  const waiting = alerts.data?.find(
    (alert) =>
      alert.product_id === productId &&
      !alert.variant_id &&
      alert.status === "waiting",
  )
  const subscribed =
    Boolean(waiting) ||
    (!customer.data && create.isSuccess && Boolean(create.variables?.email))
  const queryError =
    customer.isError || (Boolean(customer.data) && alerts.isError)
  const pending =
    customer.isPending ||
    (Boolean(customer.data) && alerts.isPending) ||
    create.isPending ||
    cancel.isPending ||
    (Boolean(customer.data) && alerts.isFetching && create.isSuccess)
  const label = queryError
    ? "Retry loading notifications"
    : subscribed
      ? customer.data
        ? `Cancel availability notification for ${title}`
        : `Notification enabled for ${title}`
      : `Notify me when ${title} is available`

  async function subscribe(email?: string) {
    setMessage("")
    setFailed(false)
    try {
      await create.mutateAsync({
        product_id: productId,
        ...(email ? { email } : {}),
      })
      setMessage("We'll email you when it's available.")
      toast.success("We'll email you when it's available", {
        description: title,
      })
    } catch {
      setFailed(true)
      setMessage("Couldn't save your notification. Please try again.")
      toast.error("Couldn't save your notification", {
        description: "Please try again.",
      })
    }
  }

  async function activate() {
    if (queryError) {
      await customer.refetch()
      if (customer.data) await alerts.refetch()
      return
    }
    if (!customer.data) {
      setOpen(true)
      return
    }
    if (!waiting) {
      await subscribe()
      return
    }
    setMessage("")
    setFailed(false)
    try {
      await cancel.mutateAsync(waiting.id)
      create.reset()
      setMessage("Notification cancelled.")
      toast.info("Notification cancelled", { description: title })
    } catch {
      setFailed(true)
      setMessage("Couldn't cancel your notification. Please try again.")
      toast.error("Couldn't cancel your notification", {
        description: "Please try again.",
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={cn(controlClass, !subscribed && hoverOnly)}
        aria-label={label}
        title={label}
        disabled={pending}
        onClick={(event) => {
          if (customer.data || queryError) {
            event.preventBaseUIHandler()
            void activate()
          }
        }}
      >
        <BellIcon
          aria-hidden
          className={cn("size-5", subscribed && "text-gold")}
          weight={subscribed ? "fill" : "regular"}
        />
      </DialogTrigger>
      <Feedback failed={failed || queryError}>
        {queryError
          ? "Couldn't load notifications. Tap the bell to retry."
          : message}
      </Feedback>
      <DialogContent>
        <DialogTitle>
          {subscribed ? "You're on the list" : "Be the first to know"}
        </DialogTitle>
        <DialogDescription>
          {subscribed
            ? `We'll email you when ${title} is available.`
            : `Leave your email and we'll let you know when ${title} is available in any size or colour.`}
        </DialogDescription>
        {!subscribed && (
          <form
            className="grid gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (create.isPending) return
              const email = String(
                new FormData(event.currentTarget).get("email") ?? "",
              ).trim()
              void subscribe(email)
            }}
          >
            <div className="grid gap-2">
              <label htmlFor={emailId}>Email address</label>
              <Input
                id={emailId}
                name="email"
                type="email"
                autoComplete="email"
                required
                disabled={create.isPending}
              />
            </div>
            <Button type="submit" disabled={create.isPending} className="h-11">
              {create.isPending ? "Saving…" : "Notify me"}
            </Button>
          </form>
        )}
        <p
          role="status"
          className={message ? "text-sm leading-relaxed" : "sr-only"}
        >
          {message}
        </p>
      </DialogContent>
    </Dialog>
  )
}

function Feedback({ children, failed }: { children: string; failed: boolean }) {
  return (
    <p
      role="status"
      className={
        failed && children
          ? "absolute top-full right-0 z-20 mt-2 w-44 bg-background p-3 text-xs leading-relaxed text-foreground shadow-sm"
          : "sr-only"
      }
    >
      {children}
    </p>
  )
}
