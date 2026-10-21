import type { Metadata } from "next"
import Link from "next/link"

import { AccountShell } from "@/components/account/account-shell"
import { FORGOT_PASSWORD_PATH } from "@/lib/seo/routes"

import { ResetPasswordForm } from "./reset-password-form"

export const metadata: Metadata = {
  title: "Choose a new password",
  robots: { index: false },
}

/** The page the backend's password reset email links to. */
export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/account/reset-password">) {
  const { token, email } = await searchParams

  if (typeof token !== "string" || !token || typeof email !== "string") {
    return (
      <AccountShell title="Choose a new password">
        <p className="text-[15px] text-muted-foreground">
          This link isn&apos;t complete. Open it again from the email, or{" "}
          <Link
            href={FORGOT_PASSWORD_PATH}
            className="text-foreground underline underline-offset-4"
          >
            request a new one
          </Link>
          .
        </p>
      </AccountShell>
    )
  }

  return (
    <AccountShell title="Choose a new password" intro={`For ${email}.`}>
      <ResetPasswordForm token={token} email={email} />
    </AccountShell>
  )
}
