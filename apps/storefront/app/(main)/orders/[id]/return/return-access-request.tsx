"use client"

import { primaryButtonClass } from "@/components/account/account-shell"
import { Button } from "@/components/ui/button"
import { useRequestReturnAccess } from "@/features/orders/hooks"

/**
 * A guest proves the order is theirs by opening a link sent to its email,
 * since the email itself is visible to anyone holding the order's link.
 */
export function ReturnAccessRequest({
  orderId,
  again = false,
}: {
  orderId: string
  /** After a link failed: offer a fresh one rather than the first. */
  again?: boolean
}) {
  const send = useRequestReturnAccess(orderId)

  if (send.isSuccess) {
    return (
      <p role="status" className="text-[15px]">
        We&apos;ve emailed a return link to {send.data.sent_to}. It works for 24
        hours.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {!again && (
        <p className="text-[15px] text-muted-foreground">
          To keep your order safe, we&apos;ll email a return link to the address
          you ordered with.
        </p>
      )}
      <Button
        size="lg"
        variant={again ? "outline" : "default"}
        disabled={send.isPending}
        onClick={() => send.mutate()}
        className={`self-start ${primaryButtonClass}`}
      >
        {send.isPending
          ? "Sending…"
          : again
            ? "Email me a new link"
            : "Email me a return link"}
      </Button>
      {send.isError && (
        <p role="alert" className="text-[13px] text-destructive">
          {send.error.message ||
            "We couldn't send the email. Please try again in a minute."}
        </p>
      )}
    </div>
  )
}
