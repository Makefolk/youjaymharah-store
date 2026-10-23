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
      onSuccess: (order) =>
        router.replace(orderConfirmationPath(order.id, order.access_key)),
    })
  }, [complete, router])

  if (complete.isError) {
    // No bag in this browser: the shopper paid on another device, or this
    // browser lost its cookie. Says nothing about whether the payment went
    // through (a completed bag would have returned its order), so neither
    // promise an order nor suggest paying again.
    if (isNotFound(complete.error)) {
      return (
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-medium tracking-[-0.01em]">
            We can&apos;t confirm this payment here
          </h1>
          <p className="text-[15px] text-muted-foreground">
            This browser no longer has your bag, so we can&apos;t tell from here
            whether the payment went through. If it did, your order confirmation
            email will arrive within a few minutes. Please check for it before
            paying again.
          </p>
          <p className="text-[15px] text-muted-foreground">
            If money left your account and no confirmation arrives within an
            hour, email{" "}
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
            with your bank alert and we&apos;ll sort it out.
          </p>
          <Link
            href={TRACK_ORDER_PATH}
            className="self-start underline underline-offset-4"
          >
            Find an order by its number
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
