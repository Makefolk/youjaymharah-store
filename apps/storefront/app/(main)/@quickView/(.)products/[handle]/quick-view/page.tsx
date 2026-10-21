import { notFound } from "next/navigation"

import { QuickViewDialog } from "@/components/catalog/quick-view-dialog"
import { getProductByHandle } from "@/lib/medusa/catalog"

/** A card's "Quick view", over the page the shopper was on. */
export default async function QuickViewPage({
  params,
}: {
  params: Promise<{ handle: string }>
}) {
  const product = await getProductByHandle((await params).handle)
  if (!product) notFound()
  return <QuickViewDialog product={product} />
}
