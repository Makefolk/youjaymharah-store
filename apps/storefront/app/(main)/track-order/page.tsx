import type { Metadata } from "next"
import Link from "next/link"

import { AccountShell } from "@/components/account/account-shell"
import { SIGN_IN_PATH } from "@/lib/seo/routes"

import { TrackOrderForm } from "./track-order-form"

export const metadata: Metadata = {
  title: "Track your order",
  description:
    "Check your order's progress, see tracking and request a return with your order number and email.",
}

export default function TrackOrderPage() {
  return (
    <AccountShell
      title="Track your order"
      intro="Enter the order number from your confirmation email and the email you ordered with."
    >
      <TrackOrderForm />
      <p className="mt-10 border-t border-border/70 pt-6 text-[13px] text-muted-foreground">
        Have an account?{" "}
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
