import type { HttpTypes } from "@medusajs/types"

import {
  categoryPath,
  collectionPath,
  COLLECTIONS_PATH,
} from "@/lib/seo/routes"

import { getCategoryTrail, sortCategoryTree } from "./category"
import { getCollectionContent, hasCollectionPage } from "./collection"

/**
 * The site navigation, built from the admin's category tree so new categories
 * appear without code changes. Build it on the server (it's plain data) and
 * render the desktop and mobile menus from the same model.
 *
 * Rules:
 * - Top-level categories are departments (Women, later Men). While there is
 *   only one, the department level is hidden everywhere: `showDepartments` is
 *   false and the menu starts from its subcategories.
 * - A subcategory with its own subcategories is a column: its name is the
 *   heading and its subcategories are the links (Accessories → Bags, Shoes).
 * - Subcategories without their own are gathered into one column under a fixed
 *   heading ("Clothing"), placed where the first of them sits in the admin's
 *   order, and split into balanced columns when there are many.
 */

/** Heading for a department's subcategories that have none of their own. */
export const DEFAULT_LOOSE_GROUP_LABEL = "Clothing"

/** Links in a column before it is split or cut off with "View all". */
export const MENU_COLUMN_LIMIT = 8

type CategoryNode = Pick<
  HttpTypes.StoreProductCategory,
  "id" | "name" | "handle" | "rank"
> & {
  category_children?: CategoryNode[] | null
}

export type MenuLink = { id: string; label: string; href: string }

export type MenuColumn = {
  id: string
  /** Null on a column that continues the previous one. */
  heading: string | null
  /** The heading's own page; null for the gathered "Clothing" group. */
  href: string | null
  links: MenuLink[]
  /** Set when links were cut off: the heading's page lists them all. */
  moreHref: string | null
}

export type MenuDepartment = {
  id: string
  label: string
  /** The department's page, for "Shop all". */
  href: string
  columns: MenuColumn[]
}

export type MenuModel = {
  departments: MenuDepartment[]
  /** False while there is one department: don't show its name anywhere. */
  showDepartments: boolean
}

export type MenuOptions = {
  looseGroupLabel?: string
  columnLimit?: number
}

function hasChildren(category: CategoryNode): boolean {
  return Boolean(category.category_children?.length)
}

function toLink(category: CategoryNode): MenuLink {
  return {
    id: category.id,
    label: category.name,
    href: categoryPath(category.handle),
  }
}

/** Splits into as few columns as fit `limit`, as evenly as possible. */
function splitEvenly<T>(items: T[], limit: number): T[][] {
  if (items.length <= limit) {
    return [items]
  }

  const count = Math.ceil(items.length / limit)
  const size = Math.ceil(items.length / count)
  const columns: T[][] = []

  for (let start = 0; start < items.length; start += size) {
    columns.push(items.slice(start, start + size))
  }

  return columns
}

function toDepartment(
  root: CategoryNode,
  looseLabel: string,
  limit: number,
): MenuDepartment {
  const children = root.category_children ?? []
  const loose = children.filter((child) => !hasChildren(child))
  const columns: MenuColumn[] = []
  let looseAdded = false

  for (const child of children) {
    if (hasChildren(child)) {
      const links = (child.category_children ?? []).map(toLink)

      columns.push({
        id: child.id,
        heading: child.name,
        href: categoryPath(child.handle),
        links: links.slice(0, limit),
        moreHref: links.length > limit ? categoryPath(child.handle) : null,
      })
    } else if (!looseAdded) {
      looseAdded = true

      splitEvenly(loose.map(toLink), limit).forEach((links, index) => {
        columns.push({
          id: `${root.id}:loose:${index}`,
          heading: index === 0 ? looseLabel : null,
          href: null,
          links,
          moreHref: null,
        })
      })
    }
  }

  return {
    id: root.id,
    label: root.name,
    href: categoryPath(root.handle),
    columns,
  }
}

/** The navigation for a category tree from `getCategoryTree()`. */
export function getMenuModel(
  tree: CategoryNode[],
  options: MenuOptions = {},
): MenuModel {
  const looseLabel = options.looseGroupLabel ?? DEFAULT_LOOSE_GROUP_LABEL
  const limit = options.columnLimit ?? MENU_COLUMN_LIMIT
  const departments = sortCategoryTree(tree).map((root) =>
    toDepartment(root, looseLabel, limit),
  )

  return { departments, showDepartments: departments.length > 1 }
}

/**
 * Columns with continuation columns folded back into the one they continue,
 * for layouts that list groups rather than columns (the mobile menu).
 */
export function getMenuGroups(department: MenuDepartment): MenuColumn[] {
  const groups: MenuColumn[] = []

  for (const column of department.columns) {
    const previous = groups[groups.length - 1]

    if (column.heading === null && previous) {
      groups[groups.length - 1] = {
        ...previous,
        links: [...previous.links, ...column.links],
      }
    } else {
      groups.push(column)
    }
  }

  return groups
}

export type MenuBreadcrumb = { name: string; handle: string; href: string }

/**
 * A category's breadcrumbs, leaving out the department while it is the only
 * one (Dresses rather than Women › Dresses), to match the menu. Needs the
 * category fetched with its parents (`getCategoryByHandle`).
 */
export function getBreadcrumbs(
  category: Parameters<typeof getCategoryTrail>[0],
  menu: Pick<MenuModel, "showDepartments">,
): MenuBreadcrumb[] {
  const trail = getCategoryTrail(category)
  const visible =
    !menu.showDepartments && trail.length > 1 ? trail.slice(1) : trail

  return visible.map((crumb) => ({
    ...crumb,
    href: categoryPath(crumb.handle),
  }))
}

export type ActiveMenuItem = {
  departmentId: string | null
  columnId: string | null
  /** The most specific menu address the current page is on or under. */
  href: string | null
}

function matches(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`)
}

/** Which department, column and link to highlight for a page address. */
export function findActiveMenuItem(
  menu: MenuModel,
  pathname: string,
): ActiveMenuItem {
  let best: ActiveMenuItem = { departmentId: null, columnId: null, href: null }

  const consider = (
    href: string | null,
    departmentId: string,
    columnId: string | null,
  ) => {
    if (
      href &&
      matches(pathname, href) &&
      href.length > (best.href?.length ?? -1)
    ) {
      best = { departmentId, columnId, href }
    }
  }

  for (const department of menu.departments) {
    consider(department.href, department.id, null)

    for (const column of department.columns) {
      consider(column.href, department.id, column.id)

      for (const link of column.links) {
        consider(link.href, department.id, column.id)
      }
    }
  }

  return best
}

export type CollectionTile = {
  id: string
  title: string
  href: string
  description: string | null
  /** Landscape banner. */
  image: string | null
  /** Portrait banner. */
  mobileImage: string | null
  /** The collection chosen in Settings -> Storefront -> Homepage. */
  featured: boolean
}

export type CollectionMenu = {
  /**
   * `hidden` with no collections, `link` with one (straight to it), `menu`
   * with several.
   */
  display: "hidden" | "link" | "menu"
  href: string
  /** Featured collection first. */
  tiles: CollectionTile[]
}

/** Collections for the header, the featured one first. */
export function getCollectionMenu(
  collections: Pick<
    HttpTypes.StoreCollection,
    "id" | "title" | "handle" | "metadata"
  >[],
  featuredId: string | null,
  limit = 4,
): CollectionMenu {
  const tiles = collections
    .filter(hasCollectionPage)
    .map((collection): CollectionTile => {
      const content = getCollectionContent(collection)

      return {
        id: content.id,
        title: content.title,
        href: collectionPath(content.handle),
        description: content.description,
        image: content.heroImage,
        mobileImage: content.heroImageMobile,
        featured: content.id === featuredId,
      }
    })
    .sort((a, b) => Number(b.id === featuredId) - Number(a.id === featuredId))

  if (!tiles.length) {
    return { display: "hidden", href: COLLECTIONS_PATH, tiles: [] }
  }

  if (tiles.length === 1) {
    return { display: "link", href: tiles[0].href, tiles }
  }

  return {
    display: "menu",
    href: COLLECTIONS_PATH,
    tiles: tiles.slice(0, limit),
  }
}
