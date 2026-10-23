"use client"

import Image from "next/image"
import NextLink from "next/link"

import { NavigationMenuLink } from "@/components/ui/navigation-menu"
import type { StoreMenuPromo } from "@/features/catalog/provider"
import { useActiveMenuItem } from "@/features/catalog/use-active-menu-item"
import type {
  CollectionMenu,
  CollectionTile,
  MenuDepartment,
} from "@/lib/medusa/menu"
import { cn } from "@/lib/util/cn"
import { ArrowRightIcon } from "@phosphor-icons/react"

type NavigationMenuLinkProps = React.ComponentProps<typeof NavigationMenuLink>

export function MenuLink({
  href,
  className,
  children,
  ...props
}: Omit<NavigationMenuLinkProps, "href" | "render"> & { href: string }) {
  return (
    <NavigationMenuLink
      render={<NextLink href={href} />}
      closeOnClick
      className={cn(
        "block p-0 hover:bg-transparent focus:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring data-active:bg-transparent data-active:hover:bg-transparent data-active:focus:bg-transparent",
        className,
      )}
      {...props}
    >
      {children}
    </NavigationMenuLink>
  )
}

const headingClass =
  "text-sm font-medium tracking-[0.08em] text-muted-foreground uppercase"

const linkClass =
  "leading-6 decoration-gold underline-offset-4 transition-colors hover:text-muted-foreground data-active:underline"

const actionClass =
  "text-xs font-medium tracking-[0.06em] uppercase underline-offset-4 hover:underline"

const imageClass =
  "object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"

const scrimClass =
  "bg-linear-to-t from-scrim/85 from-5% via-scrim/30 via-55% to-transparent p-6 pt-32 text-white"

const bannerTitleClass =
  "font-display text-balance decoration-gold decoration-[1.5px] underline-offset-10"

export function DepartmentPanel({
  department,
  promos,
}: {
  department: MenuDepartment
  promos: StoreMenuPromo[]
}) {
  const active = useActiveMenuItem()

  return (
    <div className="container-wrapper flex max-h-(--available-height,80vh) items-stretch gap-10 px-5 sm:px-6 xl:gap-16">
      <div className="flex min-w-0 flex-1 flex-col overflow-y-auto py-10">
        <div className="flex flex-wrap gap-x-12 gap-y-10">
          {department.columns.map((column) => (
            <div key={column.id} className="min-w-40">
              <ColumnHeading column={column} />

              <ul
                aria-label={column.heading ?? undefined}
                className="mt-4 flex flex-col gap-2"
              >
                {column.links.map((link) => (
                  <li key={link.id}>
                    <MenuLink
                      href={link.href}
                      active={active.href === link.href}
                      className={linkClass}
                    >
                      {link.label}
                    </MenuLink>
                  </li>
                ))}
                {column.moreHref && (
                  <li className="pt-1">
                    <MenuLink href={column.moreHref} className={actionClass}>
                      View all
                    </MenuLink>
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12">
          <MenuLink
            href={department.href}
            className={cn("inline-flex items-center gap-2", actionClass)}
          >
            Shop all <ArrowRightIcon />
          </MenuLink>
        </div>
      </div>

      {promos.length > 0 && (
        <div
          className={cn(
            "group/promos hidden shrink-0 gap-4 pb-4 lg:flex",
            promos.length > 1 ? "w-104 xl:w-136" : "w-76 xl:w-96",
          )}
        >
          {promos.map((promo) => (
            <PromoCard
              key={promo.href}
              promo={promo}
              alone={promos.length === 1}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PromoCard({
  promo,
  alone,
}: {
  promo: StoreMenuPromo
  alone: boolean
}) {
  return (
    <MenuLink
      href={promo.href}
      className="group relative min-h-84 flex-1 overflow-hidden bg-muted transition-opacity duration-500 ease-out group-hover/promos:opacity-70 hover:opacity-100! motion-reduce:transition-none"
    >
      <Image
        src={promo.mobile_image_url ?? promo.image_url}
        alt=""
        fill
        sizes={
          alone
            ? "(min-width: 1280px) 24rem, 19rem"
            : "(min-width: 1280px) 17rem, 13rem"
        }
        className={imageClass}
      />

      <span
        className={cn(
          "absolute inset-x-0 bottom-0 flex flex-col items-start gap-3",
          scrimClass,
        )}
      >
        <span
          className={cn(
            bannerTitleClass,
            "text-[2rem] leading-[1.05] group-hover:underline",
            alone && "xl:text-display-md",
          )}
        >
          {promo.title}
        </span>

        {alone && (
          <span
            className={cn(
              actionClass,
              "inline-flex items-center gap-2 text-white/80 transition-colors group-hover:text-white",
            )}
          >
            Shop now <ArrowRightIcon />
          </span>
        )}
      </span>
    </MenuLink>
  )
}

function ColumnHeading({
  column,
}: {
  column: MenuDepartment["columns"][number]
}) {
  if (column.heading === null) {
    return (
      <p aria-hidden className={cn(headingClass, "invisible")}>
        &nbsp;
      </p>
    )
  }

  if (column.href) {
    return (
      <MenuLink
        href={column.href}
        className={cn(headingClass, "hover:text-foreground")}
      >
        {column.heading}
      </MenuLink>
    )
  }

  return <p className={headingClass}>{column.heading}</p>
}

export function CollectionsPanel({ menu }: { menu: CollectionMenu }) {
  if (!menu.tiles.length) return null

  const emphasise = menu.tiles.length > 2 && menu.tiles.some((t) => t.featured)

  return (
    <div className="dark max-h-(--available-height,80vh) overflow-y-auto bg-background text-foreground">
      <ul className="group/banners flex h-88 items-stretch gap-px bg-border xl:h-104">
        {menu.tiles.map((tile) => {
          const lead = emphasise && tile.featured

          return (
            <li
              key={tile.id}
              className={cn("flex min-w-0", lead ? "flex-[1.6]" : "flex-1")}
            >
              <CollectionBanner tile={tile} lead={lead} />
            </li>
          )
        })}
      </ul>

      <div className="container-wrapper px-5 py-6 sm:px-6">
        <MenuLink
          href={menu.href}
          className={cn("inline-flex items-center gap-2", actionClass)}
        >
          View all collections <ArrowRightIcon />
        </MenuLink>
      </div>
    </div>
  )
}

function CollectionBanner({
  tile,
  lead,
}: {
  tile: CollectionTile
  lead: boolean
}) {
  const src = lead
    ? (tile.image ?? tile.mobileImage)
    : (tile.mobileImage ?? tile.image)

  return (
    <MenuLink
      href={tile.href}
      className="group relative flex h-full w-full flex-col justify-end overflow-hidden bg-muted transition-opacity duration-500 ease-out group-hover/banners:opacity-70 hover:opacity-100! motion-reduce:transition-none"
    >
      {src && (
        <Image
          src={src}
          alt=""
          fill
          sizes={lead ? "(min-width: 1600px) 620px, 40vw" : "25vw"}
          className={imageClass}
        />
      )}

      <span
        className={cn(
          "relative flex w-full flex-col items-start gap-2",
          scrimClass,
        )}
      >
        <span
          className={cn(
            bannerTitleClass,
            lead
              ? "text-display-md leading-[1.02] underline xl:text-[3rem]"
              : "text-[2rem] leading-[1.05]",
          )}
        >
          {tile.title}
        </span>

        {tile.description && (
          <span
            className={cn(
              "line-clamp-2 text-[13px] leading-5 text-white/70",
              lead ? "max-w-[46ch]" : "max-w-[32ch]",
            )}
          >
            {tile.description}
          </span>
        )}

        {lead && (
          <span
            className={cn(
              actionClass,
              "mt-1 inline-flex items-center gap-2 text-white/80 transition-colors group-hover:text-white",
            )}
          >
            Shop the collection <ArrowRightIcon />
          </span>
        )}
      </span>
    </MenuLink>
  )
}
