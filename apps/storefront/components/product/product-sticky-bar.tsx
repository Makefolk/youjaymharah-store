"use client"

import Image from "next/image"
import Link from "next/link"
import {
  useEffect,
  useState,
  useSyncExternalStore,
  type ReactNode,
  type RefObject,
} from "react"
import { createPortal } from "react-dom"

import { Button } from "@/components/ui/button"
import { CHECKOUT_PATH, SHOPPING_BAG_PATH } from "@/lib/seo/routes"
import { cn } from "@/lib/util/cn"

/**
 * Shows once `anchor` (the page's own buttons) has scrolled up off the
 * screen; scrolling back up to the buttons hides it again, so the two never
 * show at once. When the footer comes into view, `lift` is how far the bar
 * rises so it rests on the footer's top edge instead of covering it.
 *
 * Measured on scroll rather than with IntersectionObserver: a fast flick can
 * carry the buttons from below the screen to above it without them ever
 * intersecting, and the observer then never reports anything.
 */
function useStickyBarPosition(anchor: RefObject<HTMLElement | null>) {
  const [position, setPosition] = useState({ visible: false, lift: 0 })

  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const element = anchor.current
      const footer = document.querySelector("footer")
      if (!element) return
      const visible = element.getBoundingClientRect().bottom < 0
      const lift = footer
        ? Math.max(0, window.innerHeight - footer.getBoundingClientRect().top)
        : 0
      setPosition((current) =>
        current.visible === visible && current.lift === lift
          ? current
          : { visible, lift },
      )
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    measure()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
    }
  }, [anchor])

  return position
}

/** Only in the browser, where there is a document.body to portal into. */
const subscribeNever = () => () => {}
function useMounted() {
  return useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  )
}

const compactButton = "h-10 px-4 text-[12px] tracking-[0.06em] uppercase"

export { compactButton as stickyBarButtonClass }

/**
 * A strip along the bottom of the screen with the product as chosen so far
 * and its quick actions, for shoppers who have scrolled down to the photos,
 * details or related products.
 */
export function ProductStickyBar({
  anchor,
  thumbnail,
  title,
  chosen,
  missing,
  price,
  action,
  wishlist,
  added,
  onChange,
}: {
  anchor: RefObject<HTMLElement | null>
  thumbnail: string | null
  title: string
  /** The chosen values, e.g. ["Black", "M"]. */
  chosen: string[]
  /** What's still to choose, e.g. "Choose a size". */
  missing: string | null
  price: ReactNode
  /** The same main action as on the page. */
  action: ReactNode
  wishlist: ReactNode
  /** Just added: offer the bag instead of the button. */
  added: boolean
  /** Back up to the options. */
  onChange: () => void
}) {
  const { visible, lift } = useStickyBarPosition(anchor)
  const mounted = useMounted()

  if (!mounted) return null

  // Portalled to the body: inside the page it shares the sticky product
  // column's stacking context, and content further down paints over it.
  // Above the page and header (z-40), below dialogs and drawers (z-50).
  return createPortal(
    <div
      inert={!visible}
      aria-label="Quick add"
      role="region"
      style={{ bottom: lift }}
      className={cn(
        "fixed inset-x-0 z-45 border-t border-border bg-secondary text-secondary-foreground shadow-[0_-10px_30px_-18px_rgb(0_0_0/0.35)] transition-[translate,opacity] duration-300 ease-out motion-reduce:transition-none",
        visible ? "translate-y-0" : "translate-y-full opacity-0",
      )}
    >
      <div className="container-wrapper flex items-center gap-3 px-4 py-2.5 sm:gap-4 sm:px-6 lg:px-12">
        <button
          type="button"
          onClick={onChange}
          aria-label="Back to the options"
          className="relative aspect-4/5 w-11 shrink-0 bg-muted sm:w-12"
        >
          {thumbnail && (
            <Image
              src={thumbnail}
              alt=""
              fill
              sizes="48px"
              className="object-cover"
            />
          )}
        </button>

        <div className="min-w-0 flex-1 text-[13px] leading-snug">
          <p className="truncate font-medium">{title}</p>
          <p className="truncate text-muted-foreground">
            {chosen.length > 0 && <span>{chosen.join(" · ")}</span>}
            {chosen.length > 0 && missing && <span> · </span>}
            {missing && (
              <button
                type="button"
                onClick={onChange}
                className="text-foreground underline underline-offset-4"
              >
                {missing}
              </button>
            )}
            {!missing && (
              <>
                {chosen.length > 0 && <span> · </span>}
                <span className="tabular-nums">{price}</span>
              </>
            )}
          </p>
        </div>

        {added ? (
          <div className="flex shrink-0 items-center gap-2">
            <span
              role="status"
              className="text-[13px] text-muted-foreground max-sm:hidden"
            >
              Added
            </span>
            <Button
              variant="outline"
              nativeButton={false}
              render={<Link href={SHOPPING_BAG_PATH} />}
              className={cn(compactButton, "max-sm:hidden")}
            >
              View bag
            </Button>
            <Button
              nativeButton={false}
              render={<Link href={CHECKOUT_PATH} />}
              className={compactButton}
            >
              Checkout
            </Button>
          </div>
        ) : (
          <div className="flex shrink-0 items-center gap-2">
            {action}
            <div className="max-sm:hidden">{wishlist}</div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  )
}
