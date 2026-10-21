import type { Metadata } from "next"

import { ListingPage } from "@/components/listing/listing-page"

export const metadata: Metadata = {
  title: "New arrivals",
}

export default function NewArrivalsPage({
  searchParams,
}: PageProps<"/new-arrivals">) {
  return (
    <ListingPage
      title="New arrivals"
      scope={{}}
      defaultSort="newest"
      searchParams={searchParams}
    />
  )
}
