"use client"

import Image from "next/image"
import Link from "next/link"
import { useEffect, useState, type ReactNode, type RefObject } from "react"

import { Button } from "@/components/ui/button"
import { CHECKOUT_PATH, SHOPPING_BAG_PATH } from "@/lib/seo/routes"
import { cn } from "@/lib/util/cn"

/**
 * Shows once `anchor` (the page's own buttons) has scrolled up off the
 * screen, and hides while the footer is on screen so it never covers it.
 * Scrolling back up to the buttons hides it again, so the two never show
 * at once.
 *
 * Measured on scroll rather than with IntersectionObserver: a fast flick can
 * carry the buttons from below the screen to above it without them ever
 * intersecting, and the observer then never reports anything.
 */
function useStickyBarVisible(anchor: RefObject<HTMLElement | null>) {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    let frame = 0
    const measure = () => {
      frame = 0
      const element = anchor.current
      const footer = document.querySelector("footer")
      if (!element) return
      const anchorAbove = element.getBoundingClientRect().bottom < 0
      const footerInView = footer
        ? footer.getBoundingClientRect().top < window.innerHeight
        : false
      setVisible(anchorAbove && !footerInView)
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

  return visible
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
  const visible = useStickyBarVisible(anchor)

  return (
    <div
      inert={!visible}
      aria-label="Quick add"
      role="region"
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur transition-transform duration-300 ease-out motion-reduce:transition-none",
        visible ? "translate-y-0" : "translate-y-full",
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
    </div>
  )
}
