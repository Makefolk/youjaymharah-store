import type { Metadata } from "next"

import { AddressBook } from "./address-book"

export const metadata: Metadata = {
  title: "Your addresses",
  robots: { index: false },
}

export default function AccountAddressesPage() {
  return (
    <section aria-labelledby="addresses-title" className="mt-8">
      <h2
        id="addresses-title"
        className="border-b border-border/70 pb-3 text-[15px] font-medium"
      >
        Delivery addresses
      </h2>
      <p className="mt-4 text-[13px] text-muted-foreground">
        Saved addresses can be chosen at checkout. Your default fills in
        automatically.
      </p>
      <div className="mt-6">
        <AddressBook />
      </div>
    </section>
  )
}
