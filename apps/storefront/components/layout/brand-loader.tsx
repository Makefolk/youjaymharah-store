"use client"

import Image from "next/image"

import { useStorefrontSettings } from "@/features/site-settings/provider"
import { cn } from "@/lib/util/cn"

/**
 * The store's logo, breathing softly over a gold hairline that sweeps beneath
 * it, centred in whatever is loading: a whole page, or one section.
 *
 * Fits any logo: it is contained in a fixed box whatever its shape, and
 * without one the store name stands in. Appears after a short pause, so a
 * quick load doesn't flash it; holds still for visitors who reduce motion.
 */
export function BrandLoader({
  size = "section",
  label = "Loading",
  className,
}: {
  /** "page" fills most of the screen; "section" sizes to its container. */
  size?: "page" | "section"
  /** What screen readers announce. */
  label?: string
  className?: string
}) {
  const { brand } = useStorefrontSettings()

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex w-full items-center justify-center",
        size === "page" ? "min-h-[70svh]" : "min-h-40 py-12",
        className,
      )}
    >
      <div className="flex animate-[brand-loader-in_400ms_ease-out_250ms_both] flex-col items-center gap-5 motion-reduce:animate-none">
        <div className="flex h-14 w-32 animate-[brand-loader-breathe_1.8s_ease-in-out_infinite] items-center justify-center motion-reduce:animate-none">
          {brand.logo_url ? (
            <Image
              src={brand.logo_url}
              alt=""
              width={128}
              height={56}
              className="size-auto max-h-full max-w-full object-contain"
            />
          ) : (
            <span className="text-center text-[13px] font-medium tracking-[0.16em] uppercase">
              {brand.name}
            </span>
          )}
        </div>
        <div
          aria-hidden
          className="relative h-px w-20 overflow-hidden bg-gold-hairline"
        >
          <div className="absolute inset-y-0 w-1/2 animate-[brand-loader-sweep_1.4s_ease-in-out_infinite] bg-gold motion-reduce:hidden" />
        </div>
        <span className="sr-only">{label}</span>
      </div>
    </div>
  )
}
