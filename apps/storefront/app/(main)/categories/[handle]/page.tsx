import type { HttpTypes } from "@medusajs/types"
import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { ListingPage } from "@/components/listing/listing-page"
import type { ListingTab } from "@/components/listing/product-listing"
import { getCategoryByHandle, getCategoryTree } from "@/lib/medusa/catalog"
import { getCategorySeo } from "@/lib/medusa/category"
import { getBreadcrumbs, getMenuModel } from "@/lib/medusa/menu"
import { categoryPath } from "@/lib/seo/routes"

type Category = HttpTypes.StoreProductCategory

export async function generateMetadata({
  params,
}: PageProps<"/categories/[handle]">): Promise<Metadata> {
  const category = await getCategoryByHandle((await params).handle)

  if (!category) {
    return {}
  }

  const seo = getCategorySeo(category)

  return { title: seo.title, description: seo.description ?? undefined }
}

function findInTree(tree: Category[], id: string): Category | undefined {
  for (const node of tree) {
    if (node.id === id) return node
    const found = findInTree(node.category_children ?? [], id)
    if (found) return found
  }
}

/**
 * Tabs across the top: a category's own subcategories ("All" first), or,
 * for a category without any, its siblings under the same parent.
 */
function categoryTabs(category: Category, tree: Category[]): ListingTab[] {
  const children = category.category_children ?? []
  const parent = category.parent_category_id
    ? findInTree(tree, category.parent_category_id)
    : undefined
  const [owner, entries] = children.length
    ? [category, children]
    : parent
      ? [parent, parent.category_children ?? []]
      : [category, []]

  return [
    {
      label: "All",
      href: categoryPath(owner.handle),
      active: owner.id === category.id,
    },
    ...entries.map((entry) => ({
      label: entry.name,
      href: categoryPath(entry.handle),
      active: entry.id === category.id,
    })),
  ]
}

export default async function CategoryPage({
  params,
  searchParams,
}: PageProps<"/categories/[handle]">) {
  const { handle } = await params
  const [category, tree] = await Promise.all([
    getCategoryByHandle(handle),
    getCategoryTree(),
  ])

  if (!category) {
    notFound()
  }

  const breadcrumbs = getBreadcrumbs(category, getMenuModel(tree))

  return (
    <ListingPage
      title={category.name}
      scope={{ category: category.handle }}
      defaultSort="recommended"
      searchParams={searchParams}
      breadcrumbs={breadcrumbs.length > 1 ? breadcrumbs.slice(0, -1) : []}
      tabs={categoryTabs(category, tree)}
      footer={
        category.description ? (
          <p className="mx-auto mt-20 max-w-[65ch] px-5 text-[15px] leading-7 text-muted-foreground sm:px-6">
            {category.description}
          </p>
        ) : null
      }
    />
  )
}
