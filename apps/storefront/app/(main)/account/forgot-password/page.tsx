import type { Metadata } from "next"
import Link from "next/link"

import { AccountShell } from "@/components/account/account-shell"
import { SIGN_IN_PATH } from "@/lib/seo/routes"

import { ForgotPasswordForm } from "./forgot-password-form"

export const metadata: Metadata = {
  title: "Reset your password",
  robots: { index: false },
}

export default function ForgotPasswordPage() {
  return (
    <AccountShell
      title="Reset your password"
      intro="Enter your account's email and we'll send you a link to choose a new password."
    >
      <ForgotPasswordForm />
      <p className="mt-10 border-t border-border/70 pt-6 text-[13px] text-muted-foreground">
        Remembered it?{" "}
        <Link
          href={SIGN_IN_PATH}
          className="text-foreground underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </AccountShell>
  )
}
