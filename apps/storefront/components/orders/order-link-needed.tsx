import Link from "next/link"

import { AccountShell } from "@/components/account/account-shell"
import { SIGN_IN_PATH } from "@/lib/seo/routes"

import { TrackOrderForm } from "./track-order-form"

/**
 * Instead of a 404 when an order won't open: its link is missing or has
 * expired, or this isn't the account that placed it. Offers a fresh link by
 * email, which is all a guest can be given without proof.
 */
export function OrderLinkNeeded({ hadKey }: { hadKey: boolean }) {
  return (
    <AccountShell
      title={hadKey ? "This order link has expired" : "Open your order"}
      intro="Orders open from the link in your order emails, or when you're signed in to the account that placed them. Enter the order number and email, and we'll email you a fresh link."
    >
      <TrackOrderForm />
      <p className="mt-10 border-t border-border/70 pt-6 text-[13px] text-muted-foreground">
        Ordered with an account?{" "}
        <Link
          href={SIGN_IN_PATH}
          className="text-foreground underline underline-offset-4"
        >
          Sign in
        </Link>{" "}
        to see all your orders.
      </p>
    </AccountShell>
  )
}
