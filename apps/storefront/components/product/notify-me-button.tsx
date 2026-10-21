"use client"

import { useId, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useCustomer } from "@/features/customer/hooks"
import {
  useCreateProductAlert,
  useWaitingProductAlert,
} from "@/features/product-alerts/hooks"

/**
 * "Notify me" for the chosen variant, or the whole product when none is
 * chosen. Signed-in customers are signed up straight away; guests give an
 * email first.
 */
export function NotifyMeButton({
  productId,
  variantId,
  title,
  className,
}: {
  productId: string
  variantId: string | null
  title: string
  className?: string
}) {
  const { data: customer } = useCustomer()
  const waiting = useWaitingProductAlert(productId, variantId)
  const create = useCreateProductAlert()
  const [open, setOpen] = useState(false)
  const emailId = useId()
  const done = Boolean(waiting) || create.isSuccess

  const subscribe = (email?: string) =>
    create.mutate({
      product_id: productId,
      variant_id: variantId,
      ...(email ? { email } : {}),
    })

  return (
    <>
      <Button
        size="lg"
        variant={done ? "outline" : "default"}
        disabled={done || create.isPending}
        onClick={() => (customer ? subscribe() : setOpen(true))}
        className={className}
      >
        {done ? "We'll email you" : create.isPending ? "Saving…" : "Notify me"}
      </Button>
      {create.isError && !open && (
        <p role="alert" className="mt-2 text-[13px] text-destructive">
          Couldn&apos;t save that. Please try again.
        </p>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogTitle>
            {create.isSuccess ? "You're on the list" : "Be the first to know"}
          </DialogTitle>
          <DialogDescription>
            {create.isSuccess
              ? `We'll email you when ${title} is available.`
              : `Leave your email and we'll let you know when ${title} is available.`}
          </DialogDescription>
          {!create.isSuccess && (
            <form
              className="grid gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                const email = String(
                  new FormData(event.currentTarget).get("email") ?? "",
                ).trim()
                if (email) subscribe(email)
              }}
            >
              <div className="grid gap-2">
                <label htmlFor={emailId} className="text-[13px] font-medium">
                  Email
                </label>
                <Input
                  id={emailId}
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </div>
              <Button
                type="submit"
                disabled={create.isPending}
                className="h-11 tracking-[0.06em] uppercase"
              >
                {create.isPending ? "Saving…" : "Notify me"}
              </Button>
              {create.isError && (
                <p role="alert" className="text-[13px] text-destructive">
                  Couldn&apos;t save that. Please try again.
                </p>
              )}
            </form>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
