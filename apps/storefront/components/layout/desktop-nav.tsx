"use client"

import { useState, type RefObject } from "react"

import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu"
import { useCatalog } from "@/features/catalog/provider"
import { useOverlay } from "@/features/layout/overlays"
import { useActiveMenuItem } from "@/features/catalog/use-active-menu-item"
import { NEW_ARRIVALS_PATH } from "@/lib/seo/routes"

import { CollectionsPanel, DepartmentPanel, MenuLink } from "./mega-menu"

/** Overrides the kit's compact button look with the header's text style. */
const itemClass =
  "h-12 py-1.5 text-sm px-2 inline-flex font-medium tracking-[0.02em] decoration-gold underline-offset-6 hover:bg-transparent hover:text-muted-foreground focus:bg-transparent focus-visible:underline focus-visible:ring-0 data-current:underline data-popup-open:bg-muted data-popup-open:text-muted-foreground data-popup-open:hover:bg-muted data-popup-open:focus:bg-muted data-open:bg-muted data-open:hover:bg-muted data-open:focus:bg-muted"

const contentClass = "p-0"

/**
 * The desktop header navigation.
 *
 * - One department (today): a "Shop" menu with its categories; the
 *   department's name isn't shown.
 * - Several departments: one menu per department ("Women", "Men").
 * - "New arrivals" is a plain link.
 * - "Collections" is a menu of banners with several collections, a link with
 *   one, and absent with none.
 *
 * Menus open as a full-width panel under the header: pass the header element
 * as `anchor`.
 */
export function DesktopNav({
  anchor,
}: {
  anchor: RefObject<HTMLElement | null>
}) {
  const { menu, collectionMenu, storeMenuCards } = useCatalog()
  const active = useActiveMenuItem()
  const overlay = useOverlay("menu")
  const [item, setItem] = useState<string | null>(null)

  // Derived rather than synced: when search or the drawer takes the slot this
  // falls to null on the same render and the panel closes with it, instead of
  // an effect racing the panel that replaced it.
  const value =
    overlay.open &&
    (item !== "collections" || collectionMenu.display === "menu")
      ? item
      : null

  const departments = menu.showDepartments
    ? menu.departments
    : menu.departments.slice(0, 1)

  return (
    <NavigationMenu
      value={value}
      onValueChange={(next) => {
        setItem(next as string | null)
        overlay.setOpen(next !== null)
      }}
      aria-label="Catalogue"
      className="hidden items-stretch md:flex"
      delay={80}
      closeDelay={120}
      positionerProps={{
        anchor,
        sideOffset: -1,
        collisionPadding: 0,
        collisionAvoidance: { side: "none" },
        className: "z-40 w-(--anchor-width)",
      }}
      popupClassName="w-full bg-background text-foreground shadow-none ring-0 data-ending-style:scale-100 data-starting-style:scale-100"
    >
      <NavigationMenuList className="gap-7">
        {departments.map((department) => {
          const label = menu.showDepartments ? department.label : "Shop"
          const current = active.departmentId === department.id

          return department.columns.length ? (
            <NavigationMenuItem key={department.id} value={department.id}>
              <NavigationMenuTrigger
                className={itemClass}
                data-current={current || undefined}
              >
                {label}
              </NavigationMenuTrigger>
              <NavigationMenuContent className={contentClass}>
                <DepartmentPanel
                  department={department}
                  promos={storeMenuCards}
                />
              </NavigationMenuContent>
            </NavigationMenuItem>
          ) : (
            <NavigationMenuItem key={department.id}>
              <MenuLink
                href={department.href}
                active={current}
                className={itemClass}
              >
                {label}
              </MenuLink>
            </NavigationMenuItem>
          )
        })}

        {collectionMenu.display === "menu" && (
          <NavigationMenuItem value="collections">
            <NavigationMenuTrigger className={itemClass}>
              Collections
            </NavigationMenuTrigger>
            <NavigationMenuContent className={contentClass}>
              <CollectionsPanel menu={collectionMenu} />
            </NavigationMenuContent>
          </NavigationMenuItem>
        )}

        <NavigationMenuItem
          render={<MenuLink href={NEW_ARRIVALS_PATH} className={itemClass} />}
        >
          New arrivals
        </NavigationMenuItem>

        {collectionMenu.display === "link" && (
          <NavigationMenuItem>
            <MenuLink href={collectionMenu.href} className={itemClass}>
              {collectionMenu.tiles[0].title}
            </MenuLink>
          </NavigationMenuItem>
        )}
      </NavigationMenuList>
    </NavigationMenu>
  )
}
