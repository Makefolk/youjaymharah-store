"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

import {
  ACCOUNT_ADDRESSES_PATH,
  ACCOUNT_DETAILS_PATH,
  ACCOUNT_PATH,
  ACCOUNT_PREFERENCES_PATH,
  ACCOUNT_SUPPORT_PATH,
  WISHLIST_PATH,
} from "@/lib/seo/routes"
import { cn } from "@/lib/util/cn"

const SECTIONS = [
  { href: ACCOUNT_PATH, label: "Orders" },
  { href: ACCOUNT_DETAILS_PATH, label: "Your details" },
  { href: ACCOUNT_ADDRESSES_PATH, label: "Addresses" },
  { href: ACCOUNT_SUPPORT_PATH, label: "Support" },
  { href: ACCOUNT_PREFERENCES_PATH, label: "Preferences" },
  { href: WISHLIST_PATH, label: "Wishlist" },
]

/** Scrolls sideways on phones rather than wrapping onto two lines. */
export function AccountNav() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Account"
      className="-mx-5 mt-10 [scrollbar-width:none] overflow-x-auto border-b border-border/70 px-5 sm:mx-0 sm:px-0"
    >
      <ul className="flex w-max gap-6 text-[13px] font-medium">
        {SECTIONS.map((section) => {
          const current = pathname === section.href
          return (
            <li key={section.href}>
              <Link
                href={section.href}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "-mb-px inline-block border-b pb-3 transition-colors",
                  current
                    ? "border-foreground text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                {section.label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
