import type { Metadata } from "next"
import Link from "next/link"
import { AccountShell } from "@/components/account/account-shell"
import { OrderLinkNeeded } from "@/components/orders/order-link-needed"
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
  const { kind, key } = await searchParams
  const orderKey = typeof key === "string" && key ? key : null
  const order = await fetchOrderOnServer(id, orderKey)
  if (!order) return <OrderLinkNeeded hadKey={Boolean(orderKey)} />

  return (
    <AccountShell
      title="Get help with your order"
      intro={`Order ${formatOrderNumber(order.display_id)}. We'll reply to the email on the order.`}
    >
      <OrderHelpForm
        orderId={order.id}
        orderKey={orderKey}
        initialKind={typeof kind === "string" ? kind : null}
      />
      <div className="mt-10 border-t border-border/70 pt-6">
        <Link
          href={orderPath(order.id, orderKey)}
          className="text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Back to order {formatOrderNumber(order.display_id)}
        </Link>
      </div>
    </AccountShell>
  )
}
