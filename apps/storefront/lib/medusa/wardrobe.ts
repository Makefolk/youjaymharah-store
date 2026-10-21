import type { HttpTypes } from "@medusajs/types"

import { categoryPath } from "@/lib/seo/routes"

import { sortCategoryTree } from "./category"
import { metaImage } from "./metadata"

/**
 * The home page's "Shop by wardrobe" section, built from the admin's category
 * tree with the same rules as the menu (`menu.ts`), so a new category shows
 * up in both without code changes:
 *
 * - Top-level categories are departments (Women, later Men).
 * - A department's direct subcategories are its wardrobes (Ready-to-wear,
 *   Bubu, Corporate, Trads), in the admin's order. Deeper categories
 *   (Ready-to-wear → Dresses) belong to their wardrobe.
 * - While there is one department its name is not shown, as in the menu.
 *
 * Staff set a wardrobe's picture in the category's "Website content" box
 * (`metadata.thumbnail`).
 */

type CategoryNode = Pick<
  HttpTypes.StoreProductCategory,
  "id" | "name" | "handle" | "rank" | "metadata"
> & {
  category_children?: CategoryNode[] | null
}

export type Wardrobe = {
  id: string
  name: string
  href: string
  /** Staff's picture, or null to fall back to one of its products. */
  image: string | null
  /** The wardrobe and every category under it, for product lookups. */
  categoryIds: string[]
}

export type WardrobeDepartment = {
  id: string
  label: string
  href: string
  wardrobes: Wardrobe[]
}

export type WardrobeModel = {
  departments: WardrobeDepartment[]
  /** False while there is one department: don't show its name. */
  showDepartments: boolean
}

function subtreeIds(category: CategoryNode): string[] {
  return [
    category.id,
    ...(category.category_children ?? []).flatMap(subtreeIds),
  ]
}

export function getWardrobeModel(tree: CategoryNode[]): WardrobeModel {
  const departments = sortCategoryTree(tree)
    .map((root) => ({
      id: root.id,
      label: root.name,
      href: categoryPath(root.handle),
      wardrobes: (root.category_children ?? []).map((category) => ({
        id: category.id,
        name: category.name,
        href: categoryPath(category.handle),
        image: metaImage(category.metadata?.thumbnail),
        categoryIds: subtreeIds(category),
      })),
    }))
    .filter((department) => department.wardrobes.length)

  return { departments, showDepartments: departments.length > 1 }
}
