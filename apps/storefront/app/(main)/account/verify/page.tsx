import type { Metadata } from "next"

import { AccountShell } from "@/components/account/account-shell"

import { VerifyEmail } from "./verify-email"

export const metadata: Metadata = {
  title: "Verify your email",
  robots: { index: false },
}

/** The page the backend's verification email links to. */
export default async function VerifyEmailPage({
  searchParams,
}: PageProps<"/account/verify">) {
  const { token } = await searchParams

  return (
    <AccountShell title="Verify your email">
      <VerifyEmail token={typeof token === "string" ? token : null} />
    </AccountShell>
  )
}
