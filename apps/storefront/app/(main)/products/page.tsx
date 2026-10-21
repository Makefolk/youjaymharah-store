import type { Metadata } from "next"

import { ListingPage } from "@/components/listing/listing-page"

export const metadata: Metadata = {
  title: "All products",
  description: "Every piece in the store, with filters, sort and layouts.",
}

/** The whole catalogue; the footer's "Catalog" link. */
export default function AllProductsPage({
  searchParams,
}: PageProps<"/products">) {
  return (
    <ListingPage
      title="All products"
      scope={{}}
      defaultSort="recommended"
      searchParams={searchParams}
    />
  )
}
