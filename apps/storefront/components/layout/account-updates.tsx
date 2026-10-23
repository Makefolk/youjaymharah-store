"use client"

import { useCustomer, useEmailVerification } from "@/features/customer/hooks"
import { useSupportRequests } from "@/features/support/hooks"
import { cn } from "@/lib/util/cn"

/**
 * How many things in the account need the customer: an email to verify and
 * support replies waiting. Guests have none.
 */
export function useAccountUpdates() {
  const { data: customer } = useCustomer()
  const verification = useEmailVerification({ enabled: Boolean(customer) })
  const requests = useSupportRequests()
  const replies = (requests.data ?? []).filter(
    (request) => request.status === "awaiting_customer",
  ).length
  const unverified = verification.data?.verified === false
  return replies + (unverified ? 1 : 0)
}

/** A small gold dot, for an update waiting in the account. */
export function UpdateDot({ className }: { className?: string }) {
  return (
    <>
      <span
        aria-hidden
        className={cn("inline-block size-1 rounded-full bg-gold", className)}
      />
      <span
        aria-hidden
        className={cn(
          "inline-block size-1 animate-ping rounded-full bg-gold motion-reduce:animate-none",
          className,
        )}
      />
    </>
  )
}
