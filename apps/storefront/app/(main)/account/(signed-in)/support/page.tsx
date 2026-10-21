import type { Metadata } from "next"

import { SupportRequestList } from "./support-request-list"

export const metadata: Metadata = {
  title: "Your support requests",
  robots: { index: false },
}

export default function AccountSupportPage() {
  return (
    <section aria-labelledby="support-title" className="mt-8">
      <h2
        id="support-title"
        className="border-b border-border/70 pb-3 text-[15px] font-medium"
      >
        Support requests
      </h2>
      <div className="mt-2">
        <SupportRequestList />
      </div>
    </section>
  )
}
