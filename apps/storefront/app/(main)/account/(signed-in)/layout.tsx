import { redirect } from "next/navigation"
import type { ReactNode } from "react"

import { AccountNav } from "@/components/account/account-nav"
import { EmailVerificationNotice } from "@/components/account/email-verification-notice"
import { SignOutButton } from "@/components/account/sign-out-button"
import { fetchCustomerOnServer } from "@/features/customer/server"
import { ACCOUNT_PATH, SIGN_IN_PATH } from "@/lib/seo/routes"

/** Every signed-in account page: greeting, sign out, sections. */
export default async function AccountLayout({
  children,
}: {
  children: ReactNode
}) {
  const customer = await fetchCustomerOnServer()

  if (!customer) {
    redirect(`${SIGN_IN_PATH}?next=${encodeURIComponent(ACCOUNT_PATH)}`)
  }

  return (
    <main className="container-wrapper max-w-3xl px-5 py-12 sm:px-6 sm:py-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-medium tracking-[-0.01em]">
            {customer.first_name
              ? `Hi, ${customer.first_name}`
              : "Your account"}
          </h1>
          <p className="mt-2 text-[13px] text-muted-foreground">
            {customer.email}
          </p>
        </div>
        <SignOutButton />
      </div>
      <EmailVerificationNotice />
      <AccountNav />
      {children}
    </main>
  )
}
