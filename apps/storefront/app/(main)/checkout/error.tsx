"use client"

import { ErrorView } from "@/components/layout/error-view"

export default function CheckoutError(props: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <ErrorView {...props}>
      <p className="text-[15px] text-muted-foreground">
        Your bag is safe, and you haven&apos;t been charged twice: a payment
        only goes through once on the payment page.
      </p>
    </ErrorView>
  )
}
