import { redirect } from "next/navigation"

import { productPath } from "@/lib/seo/routes"

/**
 * Reached directly (a refresh, a new tab, a shared link) rather than from a
 * card's "Quick view", which @quickView intercepts: show the full page.
 */
export default async function QuickViewFallback({
  params,
}: PageProps<"/products/[handle]/quick-view">) {
  redirect(productPath((await params).handle))
}
