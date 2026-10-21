"use client"

import Link from "next/link"

import { formatDate } from "@/components/orders/format"
import { useSupportRequests } from "@/features/support/hooks"
import { formatOrderNumber } from "@/lib/medusa/order"
import { CONTACT_PATH, supportRequestPath } from "@/lib/seo/routes"

import { STATUS_TEXT } from "../../../support/[id]/support-thread"

const KIND_TEXT: Record<string, string> = {
  question: "A question",
  order: "An order",
  delivery: "Delivery",
  return: "A return or refund",
  product: "A product or sizing",
  cancel: "Cancel an order",
  change_address: "Change a delivery address",
  exchange: "Exchange a size",
  damaged: "Damaged or faulty item",
  missing: "Missing or wrong item",
}

/**
 * Requests sent while signed in, and earlier guest ones from the same email
 * once it is verified.
 */
export function SupportRequestList() {
  const requests = useSupportRequests()

  if (requests.isPending) {
    return <p className="py-6 text-[13px] text-muted-foreground">Loading…</p>
  }
  if (!requests.data?.length) {
    return (
      <p className="py-6 text-[15px] text-muted-foreground">
        No requests yet. Need something?{" "}
        <Link
          href={CONTACT_PATH}
          className="text-foreground underline underline-offset-4"
        >
          Message us
        </Link>
        .
      </p>
    )
  }

  return (
    <ul className="divide-y divide-border/70">
      {requests.data.map((request) => (
        <li key={request.id}>
          <Link
            href={supportRequestPath(request.id)}
            className="flex items-center justify-between gap-4 py-5 outline-offset-4 focus-visible:outline-1"
          >
            <div className="min-w-0">
              <p className="text-[15px] font-medium">
                {KIND_TEXT[request.kind] ?? "A request"}
                {request.order_display_id
                  ? ` · order ${formatOrderNumber(request.order_display_id)}`
                  : ""}
              </p>
              <p className="mt-1 text-[13px] text-muted-foreground">
                {request.reference} · {STATUS_TEXT[request.status]}
              </p>
            </div>
            <p className="shrink-0 text-[13px] text-muted-foreground">
              {formatDate(request.last_message_at)}
            </p>
          </Link>
        </li>
      ))}
    </ul>
  )
}
