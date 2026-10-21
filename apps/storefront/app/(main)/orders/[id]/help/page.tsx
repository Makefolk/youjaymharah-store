import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"

import { AccountShell } from "@/components/account/account-shell"
import { fetchOrderOnServer } from "@/features/orders/server"
import { formatOrderNumber } from "@/lib/medusa/order"
import { orderPath } from "@/lib/seo/routes"

import { OrderHelpForm } from "./order-help-form"

export const metadata: Metadata = {
  title: "Get help with your order",
  robots: { index: false },
}

export default async function OrderHelpPage({
  params,
  searchParams,
}: PageProps<"/orders/[id]/help">) {
  const { id } = await params
  const { kind } = await searchParams
  const order = await fetchOrderOnServer(id)
  if (!order) notFound()

  return (
    <AccountShell
      title="Get help with your order"
      intro={`Order ${formatOrderNumber(order.display_id)}. We'll reply to the email on the order.`}
    >
      <OrderHelpForm
        orderId={order.id}
        initialKind={typeof kind === "string" ? kind : null}
      />
      <div className="mt-10 border-t border-border/70 pt-6">
        <Link
          href={orderPath(order.id)}
          className="text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Back to order {formatOrderNumber(order.display_id)}
        </Link>
      </div>
    </AccountShell>
  )
}
