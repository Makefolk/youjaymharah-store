import type { Metadata } from "next"

import { NewsletterPreference } from "./newsletter-preference"
import { StockAlerts } from "./stock-alerts"

export const metadata: Metadata = {
  title: "Your preferences",
  robots: { index: false },
}

export default function AccountPreferencesPage() {
  return (
    <div className="mt-8 flex flex-col gap-12">
      <section aria-labelledby="prefs-newsletter">
        <h2
          id="prefs-newsletter"
          className="border-b border-border/70 pb-3 text-[15px] font-medium"
        >
          Emails from us
        </h2>
        <div className="mt-6">
          <NewsletterPreference />
        </div>
      </section>
      <section aria-labelledby="prefs-alerts">
        <h2
          id="prefs-alerts"
          className="border-b border-border/70 pb-3 text-[15px] font-medium"
        >
          Stock alerts
        </h2>
        <div className="mt-6">
          <StockAlerts />
        </div>
      </section>
    </div>
  )
}
