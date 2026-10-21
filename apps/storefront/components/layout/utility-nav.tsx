"use client"

import {
  BagIcon,
  HeartIcon,
  MagnifyingGlassIcon,
  UserIcon,
} from "@phosphor-icons/react"
import NextLink from "next/link"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { useOverlay } from "@/features/layout/overlays"
import { ACCOUNT_PATH, SHOPPING_BAG_PATH } from "@/lib/seo/routes"
import { cn } from "@/lib/util/cn"

export function UtilityNav({ className }: { className?: string }) {
  const search = useOverlay("search")

  return (
    <nav aria-label="Utility" className={cn("flex *:h-auto", className)}>
      <UtilityItem
        label="Search"
        onClick={search.toggle}
        expanded={search.open}
        className="max-md:hidden"
      >
        <MagnifyingGlassIcon />
      </UtilityItem>

      <UtilityItem href="/wishlist" className="max-md:hidden" label="Wishlist">
        <HeartIcon />
      </UtilityItem>

      <UtilityItem label="Account" href={ACCOUNT_PATH}>
        <UserIcon />
        {
          // Show only when there's an account notification or user is not logged in
          <>
            <span
              aria-hidden
              className="absolute bottom-1/5 left-1/2 inline-block size-1 -translate-x-1/2 rounded-full bg-gold"
            />
            <span
              aria-hidden
              className="absolute bottom-1/5 left-1/2 inline-block size-1 -translate-x-1/2 animate-ping rounded-full bg-gold motion-reduce:animate-none"
            />
          </>
        }
      </UtilityItem>

      <UtilityItem label="Shopping bag" href={SHOPPING_BAG_PATH}>
        <BagIcon />
      </UtilityItem>
    </nav>
  )
}

interface UtitlityItemProps {
  label: string
  href?: string
  onClick?: () => void
  expanded?: boolean
  className?: string
  children: ReactNode
}

function UtilityItem({
  label,
  href,
  onClick,
  expanded,
  children,
  className,
}: UtitlityItemProps) {
  return (
    <Tooltip
      onOpenChange={(_open, details) => {
        // A tooltip is a hint, not a layer. Base UI stops Escape at the first
        // popup that handles it, and this one stays open over the panel its
        // button opened -- so without this the first press only hides the
        // hint and a second is needed to close the panel.
        if (details.reason === "escape-key") details.allowPropagation()
      }}
    >
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={label}
            aria-expanded={expanded}
            onClick={onClick}
            className={cn("relative", className)}
            render={href ? <NextLink href={href} /> : undefined}
            nativeButton={!href}
          />
        }
      >
        {children}
      </TooltipTrigger>

      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
