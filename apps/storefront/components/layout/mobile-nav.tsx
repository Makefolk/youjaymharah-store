"use client"

import {
  ArrowArcRightIcon,
  ArrowRightIcon,
  CaretLeftIcon,
  CaretRightIcon,
  ListIcon,
  XIcon,
} from "@phosphor-icons/react"
import Image from "next/image"
import { useState, type ReactNode } from "react"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { useCatalog } from "@/features/catalog/provider"
import { useOverlay } from "@/features/layout/overlays"
import { useActiveMenuItem } from "@/features/catalog/use-active-menu-item"
import { getMenuGroups, type MenuDepartment } from "@/lib/medusa/menu"
import {
  CONTACT_PATH,
  NEW_ARRIVALS_PATH,
  TRACK_ORDER_PATH,
  WISHLIST_PATH,
} from "@/lib/seo/routes"
import { cn } from "@/lib/util/cn"
import NextLink from "next/link"
import { useStorefrontSettings } from "@/features/site-settings/provider"

type View =
  | { kind: "root" }
  | { kind: "department"; departmentId: string }
  | { kind: "group"; departmentId: string; groupId: string }
  | { kind: "collections" }

const ROOT: View = { kind: "root" }

type Catalog = ReturnType<typeof useCatalog>
type Menu = Catalog["menu"]
type CollectionMenu = Catalog["collectionMenu"]

type NavProps = {
  menu: Menu
  collectionMenu: CollectionMenu
  activeHref: string | undefined
  onDrill: (view: View) => void
  onNavigate: () => void
}

const rowClass =
  "flex min-h-12 w-full px-4 items-center justify-between gap-4 border-b py-3 text-left text-[15px] outline-none focus-visible:underline"

const actionClass =
  "mt-6 px-4 inline-flex items-center gap-2 text-[12px] font-medium tracking-[0.06em] uppercase font-medium underline underline-offset-4"

/**
 * The mobile menu: a drawer from the left that drills down one level at a
 * time. With one department its groups (Clothing, Accessories) are the first
 * level; with several, the departments are.
 */
export function MobileNav() {
  const { menu, collectionMenu } = useCatalog()
  const active = useActiveMenuItem()
  const { open, setOpen } = useOverlay("mobile-nav")
  const { view, canGoBack, push, back, reset } = useDrillStack()

  return (
    <Drawer
      open={open}
      onOpenChange={setOpen}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) reset()
      }}
      swipeDirection="left"
    >
      <DrawerTrigger
        aria-label="Open menu"
        className="-ml-2 inline-flex w-10 items-center justify-center md:hidden"
      >
        <ListIcon size={20} />
        <span className="sr-only">toggle side menu</span>
      </DrawerTrigger>
      <DrawerContent>
        <ScrollArea
          className="min-h-0 flex-1"
          viewportClassName="overscroll-contain"
        >
          <div className="flex flex-col pb-10">
            <Header
              title={titleFor(view, menu.departments)}
              canGoBack={canGoBack}
              onBack={back}
            />
            <nav aria-label="Catalogue">
              <Panel
                view={view}
                menu={menu}
                collectionMenu={collectionMenu}
                activeHref={active.href ?? "#"}
                onDrill={push}
                onNavigate={() => setOpen(false)}
              />
            </nav>
          </div>
        </ScrollArea>
      </DrawerContent>
    </Drawer>
  )
}

function Header({
  title,
  canGoBack,
  onBack,
}: {
  title: string
  canGoBack: boolean
  onBack: () => void
}) {
  const { brand } = useStorefrontSettings()

  return (
    <div className="sticky top-0 z-50 flex h-12 shrink-0 items-center justify-between bg-popover px-3">
      {canGoBack ? (
        <button
          type="button"
          onClick={onBack}
          className="-ml-2 inline-flex size-10 items-center justify-center"
          aria-label="Back"
        >
          <CaretLeftIcon size={18} />
        </button>
      ) : (
        <DrawerClose
          render={
            <NextLink
              href={"/"}
              className="relative z-10 py-1 transition-[filter] *:brightness-0"
            />
          }
        >
          {brand.logo_url ? (
            <Image
              src={brand.logo_url}
              alt={brand.name}
              width={150}
              height={150}
              className="h-auto w-8"
              title={brand.name}
            />
          ) : (
            <span className="text-[15px] font-medium">{brand.name}</span>
          )}

          <span className="sr-only">Home</span>
        </DrawerClose>
      )}
      <DrawerTitle className="text-display-lg font-medium tracking-[0.02em] uppercase">
        {title}
      </DrawerTitle>
      <DrawerClose
        aria-label="Close menu"
        className="-mr-2 inline-flex size-10 items-center justify-center"
      >
        <XIcon size={18} />
      </DrawerClose>
    </div>
  )
}

function Panel({ view, ...nav }: NavProps & { view: View }) {
  switch (view.kind) {
    case "root":
      return <RootPanel {...nav} />
    case "department":
      return <DepartmentPanel departmentId={view.departmentId} {...nav} />
    case "group":
      return (
        <GroupPanel
          departmentId={view.departmentId}
          groupId={view.groupId}
          {...nav}
        />
      )
    case "collections":
      return <CollectionsPanel {...nav} />
  }
}

function RootPanel({ menu, collectionMenu, onDrill, onNavigate }: NavProps) {
  const sole = menu.showDepartments ? undefined : menu.departments[0]

  return (
    <ul>
      <CatalogEntries menu={menu} onDrill={onDrill} onNavigate={onNavigate} />
      <li>
        <LinkRow href={NEW_ARRIVALS_PATH} onNavigate={onNavigate}>
          New arrivals
        </LinkRow>
      </li>
      {collectionMenu.display === "menu" && (
        <li>
          <DrillRow
            label="Collections"
            onClick={() => onDrill({ kind: "collections" })}
          />
        </li>
      )}
      {collectionMenu.display === "link" && (
        <li>
          <LinkRow href={collectionMenu.href} onNavigate={onNavigate}>
            {collectionMenu.tiles[0].title}
          </LinkRow>
        </li>
      )}
      {sole && sole.columns.length > 0 && (
        <li>
          <ActionLink href={sole.href} onNavigate={onNavigate}>
            SHOP ALL
          </ActionLink>
        </li>
      )}
      {/* The header hides the wishlist on phones; these are its way in. */}
      <li className="mt-6 border-t border-border/70 pt-2">
        <LinkRow href={WISHLIST_PATH} onNavigate={onNavigate}>
          Wishlist
        </LinkRow>
      </li>
      <li>
        <LinkRow href={TRACK_ORDER_PATH} onNavigate={onNavigate}>
          Track an order
        </LinkRow>
      </li>
      <li>
        <LinkRow href={CONTACT_PATH} onNavigate={onNavigate}>
          Help and contact
        </LinkRow>
      </li>
    </ul>
  )
}

function CatalogEntries({
  menu,
  onDrill,
  onNavigate,
}: Pick<NavProps, "menu" | "onDrill" | "onNavigate">) {
  if (menu.showDepartments) {
    return menu.departments.map((department) => (
      <li key={department.id}>
        {department.columns.length > 0 ? (
          <DrillRow
            label={department.label}
            onClick={() =>
              onDrill({ kind: "department", departmentId: department.id })
            }
          />
        ) : (
          <LinkRow href={department.href} onNavigate={onNavigate}>
            {department.label}
          </LinkRow>
        )}
      </li>
    ))
  }

  const sole = menu.departments[0]

  if (!sole) return null

  if (sole.columns.length === 0) {
    return (
      <li>
        <LinkRow href={sole.href} onNavigate={onNavigate}>
          Shop
        </LinkRow>
      </li>
    )
  }

  return getMenuGroups(sole).map((group) => (
    <li key={group.id}>
      <DrillRow
        label={group.heading ?? ""}
        onClick={() =>
          onDrill({
            kind: "group",
            departmentId: sole.id,
            groupId: group.id,
          })
        }
      />
    </li>
  ))
}

function DepartmentPanel({
  departmentId,
  menu,
  onDrill,
  onNavigate,
}: NavProps & { departmentId: string }) {
  const department = findDepartment(menu.departments, departmentId)

  if (!department) return null

  return (
    <ul>
      {getMenuGroups(department).map((group) => (
        <li key={group.id}>
          <DrillRow
            label={group.heading ?? ""}
            onClick={() =>
              onDrill({
                kind: "group",
                departmentId: department.id,
                groupId: group.id,
              })
            }
          />
        </li>
      ))}

      <li>
        <ActionLink href={department.href} onNavigate={onNavigate}>
          SHOP ALL <ArrowArcRightIcon />
        </ActionLink>
      </li>
    </ul>
  )
}

function GroupPanel({
  departmentId,
  groupId,
  menu,
  activeHref,
  onNavigate,
}: NavProps & { departmentId: string; groupId: string }) {
  const group = findGroup(menu.departments, departmentId, groupId)

  if (!group) return null

  return (
    <ul>
      {group.links.map((item) => (
        <li key={item.id}>
          <LinkRow
            href={item.href}
            current={activeHref === item.href}
            onNavigate={onNavigate}
          >
            {item.label}
          </LinkRow>
        </li>
      ))}

      {group.href && (
        <li>
          <ActionLink href={group.href} onNavigate={onNavigate}>
            View all
          </ActionLink>
        </li>
      )}
    </ul>
  )
}

function CollectionsPanel({
  collectionMenu,
  onNavigate,
}: Pick<NavProps, "collectionMenu" | "onNavigate">) {
  const lead = collectionMenu.tiles.length > 2

  return (
    <>
      <ul>
        {collectionMenu.tiles.map((tile) => {
          const src = tile.image ?? tile.mobileImage
          const featured = lead && tile.featured

          return (
            <li key={tile.id} className="border-b last:border-b-0">
              <NextLink
                href={tile.href}
                onClick={onNavigate}
                className={cn(
                  "relative flex flex-col justify-end overflow-hidden bg-muted",
                  featured ? "h-72" : "h-52",
                )}
              >
                {src && (
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="100vw"
                    className="object-cover"
                  />
                )}

                <span className="relative flex flex-col items-start gap-1.5 bg-linear-to-t from-scrim/85 from-5% via-scrim/30 via-55% to-transparent p-4 pt-24 text-white">
                  <span
                    className={cn(
                      "line-clamp-2 font-display text-balance",
                      featured
                        ? "text-display-md leading-[1.02]"
                        : "text-[2rem] leading-[1.05]",
                    )}
                  >
                    {tile.title}
                  </span>

                  {tile.description && (
                    <span
                      className={cn(
                        "text-[13px] leading-5 text-white/70",
                        featured ? "line-clamp-2" : "line-clamp-1",
                      )}
                    >
                      {tile.description}
                    </span>
                  )}
                </span>
              </NextLink>
            </li>
          )
        })}
      </ul>

      <ActionLink href={collectionMenu.href} onNavigate={onNavigate}>
        View all collections
      </ActionLink>
    </>
  )
}

function LinkRow({
  href,
  children,
  current = false,
  onNavigate,
}: {
  href: string
  children: ReactNode
  current?: boolean
  onNavigate: () => void
}) {
  return (
    <NextLink
      href={href}
      onClick={onNavigate}
      aria-current={current ? "page" : undefined}
      className={cn(
        rowClass,
        current && "underline decoration-gold underline-offset-4",
      )}
    >
      {children}
    </NextLink>
  )
}

function DrillRow({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button type="button" className={rowClass} onClick={onClick}>
      {label}
      <CaretRightIcon size={14} aria-hidden />
    </button>
  )
}

function ActionLink({
  href,
  children,
  onNavigate,
  className,
}: {
  href: string
  className?: string
  children: ReactNode
  onNavigate: () => void
}) {
  return (
    <NextLink
      href={href}
      onClick={onNavigate}
      className={cn(actionClass, className)}
    >
      {children} <ArrowRightIcon />
    </NextLink>
  )
}

function useDrillStack() {
  const [stack, setStack] = useState<View[]>([ROOT])
  const view = stack.at(-1) ?? ROOT

  return {
    view,
    canGoBack: stack.length > 1,
    push: (next: View) => setStack((current) => [...current, next]),
    back: () =>
      setStack((current) =>
        current.length > 1 ? current.slice(0, -1) : current,
      ),
    reset: () => setStack([ROOT]),
  }
}

function findDepartment(departments: MenuDepartment[], id: string) {
  return departments.find((department) => department.id === id)
}

function findGroup(
  departments: MenuDepartment[],
  departmentId: string,
  groupId: string,
) {
  const department = findDepartment(departments, departmentId)
  return department
    ? getMenuGroups(department).find((group) => group.id === groupId)
    : undefined
}

function titleFor(view: View, departments: MenuDepartment[]) {
  switch (view.kind) {
    case "root":
      return "Menu"
    case "department":
      return findDepartment(departments, view.departmentId)?.label ?? "Menu"
    case "group":
      return (
        findGroup(departments, view.departmentId, view.groupId)?.heading ??
        "Menu"
      )
    case "collections":
      return "Collections"
  }
}
