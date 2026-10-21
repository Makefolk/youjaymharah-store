import type { Metadata } from "next"

import { CompletePayment } from "./complete-payment"

export const metadata: Metadata = {
  title: "Confirming your payment",
  robots: { index: false },
}

/**
 * Where Paystack and Credo send the shopper back, paid or not. Nothing in
 * the return address proves payment: completing the cart is what makes the
 * backend verify it with the gateway.
 */
export default function PaymentCallbackPage() {
  return (
    <main className="container-wrapper max-w-md px-5 py-16 sm:px-6 sm:py-20">
      <CompletePayment />
    </main>
  )
}
