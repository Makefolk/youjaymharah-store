import type { Metadata } from "next"
import Link from "next/link"
import { redirect } from "next/navigation"

import { AccountShell, FormAlert } from "@/components/account/account-shell"
import {
  GoogleSignInButton,
  googleSignInError,
} from "@/components/account/google-sign-in"
import { fetchCustomerOnServer } from "@/features/customer/server"
import { getStorefrontSettings } from "@/lib/medusa/storefront-settings"
import { safeNextPath, SIGN_IN_PATH } from "@/lib/seo/routes"

import { RegisterForm } from "./register-form"

export const metadata: Metadata = {
  title: "Create an account",
  robots: { index: false },
}

export default async function RegisterPage({
  searchParams,
}: PageProps<"/account/register">) {
  const params = await searchParams
  const next = safeNextPath(params.next)

  if (await fetchCustomerOnServer()) {
    redirect(next)
  }

  const { sign_in } = await getStorefrontSettings()
  const googleError = googleSignInError(params.error)

  return (
    <AccountShell
      title="Create an account"
      intro="Keep track of your orders and request returns in one place."
    >
      {googleError && (
        <div className="mb-6">
          <FormAlert>{googleError}</FormAlert>
        </div>
      )}
      {sign_in?.google && <GoogleSignInButton next={next} className="mb-6" />}
      <RegisterForm next={next} />
      <p className="mt-10 border-t border-border/70 pt-6 text-[13px] text-muted-foreground">
        Already have an account?{" "}
        <Link
          href={
            next === "/account"
              ? SIGN_IN_PATH
              : `${SIGN_IN_PATH}?next=${encodeURIComponent(next)}`
          }
          className="text-foreground underline underline-offset-4"
        >
          Sign in
        </Link>
      </p>
    </AccountShell>
  )
}
