"use client"

import { EyeIcon } from "@phosphor-icons/react"
import Link from "next/link"

import { productPath } from "@/lib/seo/routes"

/**
 * Opens the card's quick view; @quickView intercepts this one URL, so the
 * card's other links still open the full page.
 */
export function QuickViewLink({
  handle,
  title,
}: {
  handle: string
  title: string
}) {
  return (
    <Link
      href={`${productPath(handle)}/quick-view`}
      scroll={false}
      aria-label={`Quick view of ${title}`}
      title="Quick view"
      className="absolute top-14 right-2 z-10 flex size-11 items-center justify-center text-white drop-shadow-[0_1px_2px_rgb(0_0_0/0.45)] transition-opacity focus-visible:outline-2 focus-visible:outline-white max-md:hidden [@media(hover:hover)_and_(pointer:fine)]:opacity-0 [@media(hover:hover)_and_(pointer:fine)]:group-focus-within/card:opacity-100 [@media(hover:hover)_and_(pointer:fine)]:group-hover/card:opacity-100"
    >
      <EyeIcon className="size-5" />
    </Link>
  )
}
