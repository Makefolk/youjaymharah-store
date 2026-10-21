import type { Metadata } from "next"

import { PasswordSection } from "./password-section"
import { ProfileForm } from "./profile-form"

export const metadata: Metadata = {
  title: "Your details",
  robots: { index: false },
}

export default function AccountDetailsPage() {
  return (
    <div className="mt-8 flex flex-col gap-12">
      <section aria-labelledby="details-profile">
        <h2
          id="details-profile"
          className="border-b border-border/70 pb-3 text-[15px] font-medium"
        >
          Name and phone
        </h2>
        <div className="mt-6">
          <ProfileForm />
        </div>
      </section>
      <section aria-labelledby="details-password">
        <h2
          id="details-password"
          className="border-b border-border/70 pb-3 text-[15px] font-medium"
        >
          Password
        </h2>
        <div className="mt-6">
          <PasswordSection />
        </div>
      </section>
    </div>
  )
}
