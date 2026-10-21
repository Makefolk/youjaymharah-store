"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useRef } from "react"

import { Button } from "@/components/ui/button"
import { useCompleteCart } from "@/features/checkout/hooks"
import { useStorefrontSettings } from "@/features/site-settings/provider"
import { describeCompletionError } from "@/lib/medusa/checkout"
import { isNotFound } from "@/lib/medusa/errors"
import {
  CHECKOUT_PATH,
  orderConfirmationPath,
  TRACK_ORDER_PATH,
} from "@/lib/seo/routes"

export function CompletePayment() {
  const router = useRouter()
  const complete = useCompleteCart()
  const supportEmail = useStorefrontSettings().brand.support_email
  const started = useRef(false)

  useEffect(() => {
    // Once only: completing twice is harmless, but development mode mounts
    // effects twice and the second request would be wasted.
    if (started.current) return
    started.current = true
    complete.mutate(undefined, {
      onSuccess: (order) => router.replace(orderConfirmationPath(order.id)),
    })
  }, [complete, router])

  if (complete.isError) {
    // No cart in this browser: it was completed already (for instance by the
    // gateway's webhook in another tab), or the shopper paid on another device.
    if (isNotFound(complete.error)) {
      return (
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-medium tracking-[-0.01em]">
            We couldn&apos;t find your bag
          </h1>
          <p className="text-[15px] text-muted-foreground">
            If you paid, your order is confirmed and the confirmation email is
            on its way. You can also find the order with its number and your
            email.
          </p>
          <Link
            href={TRACK_ORDER_PATH}
            className="self-start underline underline-offset-4"
          >
            Find your order
          </Link>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-4">
        <h1 className="text-2xl font-medium tracking-[-0.01em]">
          Payment not completed
        </h1>
        <p className="text-[15px] text-muted-foreground">
          {describeCompletionError(complete.error.message)}
        </p>
        <p className="text-[15px] text-muted-foreground">
          No order was placed and your bag is as you left it. If money left your
          account anyway, don&apos;t pay again: email{" "}
          {supportEmail ? (
            <a
              href={`mailto:${supportEmail}`}
              className="text-foreground underline underline-offset-4"
            >
              {supportEmail}
            </a>
          ) : (
            "us"
          )}{" "}
          and we&apos;ll sort it out.
        </p>
        <Button
          size="lg"
          nativeButton={false}
          render={<Link href={`${CHECKOUT_PATH}?payment=failed`} />}
          className="h-10 self-start px-5 tracking-[0.06em] uppercase"
        >
          Back to checkout
        </Button>
      </div>
    )
  }

  return (
    <div role="status" className="flex flex-col gap-3">
      <h1 className="text-2xl font-medium tracking-[-0.01em]">
        Confirming your payment…
      </h1>
      <p className="text-[15px] text-muted-foreground">
        This takes a few seconds. Please don&apos;t close this page.
      </p>
    </div>
  )
}
