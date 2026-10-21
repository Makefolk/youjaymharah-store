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
import {
  FORGOT_PASSWORD_PATH,
  REGISTER_PATH,
  safeNextPath,
  TRACK_ORDER_PATH,
} from "@/lib/seo/routes"

import { SignInForm } from "./sign-in-form"

export const metadata: Metadata = {
  title: "Sign in",
  robots: { index: false },
}

export default async function SignInPage({
  searchParams,
}: PageProps<"/account/sign-in">) {
  const params = await searchParams
  const next = safeNextPath(params.next)

  if (await fetchCustomerOnServer()) {
    redirect(next)
  }

  const { sign_in } = await getStorefrontSettings()
  const googleError = googleSignInError(params.error)

  const withNext = (path: string) =>
    next === "/account" ? path : `${path}?next=${encodeURIComponent(next)}`

  return (
    <AccountShell title="Sign in" intro="See your orders and request returns.">
      {googleError && (
        <div className="mb-6">
          <FormAlert>{googleError}</FormAlert>
        </div>
      )}
      {sign_in?.google && <GoogleSignInButton next={next} className="mb-6" />}
      <SignInForm next={next} forgotHref={FORGOT_PASSWORD_PATH} />
      <div className="mt-10 flex flex-col gap-3 border-t border-border/70 pt-6 text-[13px] text-muted-foreground">
        <p>
          New here?{" "}
          <Link
            href={withNext(REGISTER_PATH)}
            className="text-foreground underline underline-offset-4"
          >
            Create an account
          </Link>
        </p>
        <p>
          Ordered as a guest?{" "}
          <Link
            href={TRACK_ORDER_PATH}
            className="text-foreground underline underline-offset-4"
          >
            Find your order
          </Link>
        </p>
      </div>
    </AccountShell>
  )
}
