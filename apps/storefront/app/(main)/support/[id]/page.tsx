import type { Metadata } from "next"
import Link from "next/link"

import { AccountShell } from "@/components/account/account-shell"
import { fetchSupportRequestOnServer } from "@/features/support/server"
import { formatOrderNumber } from "@/lib/medusa/order"
import { CONTACT_PATH, orderPath, SIGN_IN_PATH } from "@/lib/seo/routes"

import { FreshLink } from "./fresh-link"
import { SupportThread } from "./support-thread"

export const metadata: Metadata = {
  title: "Your request",
  robots: { index: false },
}

/** Opened from the email link (?access=) or the account's Support tab. */
export default async function SupportRequestPage({
  params,
  searchParams,
}: PageProps<"/support/[id]">) {
  const { id } = await params
  const { access } = await searchParams
  const key = typeof access === "string" && access ? access : null
  const request = await fetchSupportRequestOnServer(id, key)

  if (!request) {
    return (
      <AccountShell
        title={key ? "This link no longer works" : "Request not found"}
      >
        <p className="text-[15px] text-muted-foreground">
          {key
            ? "Links to a request work for 90 days, and we can cancel them. We can email a fresh one to the address the request was made with, or "
            : "Open it from the link in our email, or "}
          <Link
            href={SIGN_IN_PATH}
            className="text-foreground underline underline-offset-4"
          >
            sign in
          </Link>{" "}
          to see your requests. Still stuck?{" "}
          <Link
            href={CONTACT_PATH}
            className="text-foreground underline underline-offset-4"
          >
            Send us a new message
          </Link>
          .
        </p>
        {key && (
          <div className="mt-6">
            <FreshLink requestId={id} />
          </div>
        )}
      </AccountShell>
    )
  }

  return (
    <AccountShell
      title={`Request ${request.reference}`}
      intro={
        request.order_id ? (
          <>
            About{" "}
            <Link
              href={orderPath(request.order_id)}
              className="text-foreground underline underline-offset-4"
            >
              order {formatOrderNumber(request.order_display_id ?? undefined)}
            </Link>
            .
          </>
        ) : undefined
      }
    >
      <SupportThread request={request} access={key} />
    </AccountShell>
  )
}
