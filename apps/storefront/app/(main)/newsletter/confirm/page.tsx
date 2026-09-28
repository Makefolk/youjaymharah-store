import type { Metadata } from "next"

import { fetchCustomerOnServer } from "@/features/customer/server"

import { ConfirmSubscriptionForm } from "./confirm-subscription-form"

export const metadata: Metadata = {
  title: "Confirm your subscription",
  robots: { index: false },
}

export default async function ConfirmNewsletterPage({
  searchParams,
}: PageProps<"/newsletter/confirm">) {
  const { token } = await searchParams
  const customer =
    typeof token === "string" && token ? await fetchCustomerOnServer() : null

  return (
    <main className="container-wrapper max-w-xl px-5 py-16 sm:px-6">
      <h1 className="text-2xl font-medium tracking-[-0.01em]">
        Confirm your subscription
      </h1>
      {typeof token === "string" && token ? (
        <>
          <p className="mt-3 text-[15px] text-muted-foreground">
            One more step: tell us your first name and confirm your subscription
            to The YJ Edit.
          </p>
          <div className="mt-6">
            <ConfirmSubscriptionForm
              token={token}
              firstName={customer?.first_name ?? ""}
            />
          </div>
        </>
      ) : (
        <p className="mt-3 text-[15px] text-muted-foreground">
          This link isn&apos;t complete. Open it again from the email.
        </p>
      )}
    </main>
  )
}
