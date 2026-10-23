import type { Metadata } from "next"
import Link from "next/link"
import { AccountShell } from "@/components/account/account-shell"
import { OrderLinkNeeded } from "@/components/orders/order-link-needed"
import { formatDate } from "@/components/orders/format"
import { fetchCustomerOnServer } from "@/features/customer/server"
import {
  fetchOrderOnServer,
  fetchReturnOptionsOnServer,
  listReturnReasonsOnServer,
} from "@/features/orders/server"
import { formatOrderNumber } from "@/lib/medusa/order"
import { orderPath } from "@/lib/seo/routes"

import { ReturnAccessRequest } from "./return-access-request"
import { ReturnRequestForm, type ReturnableItem } from "./return-request-form"

export const metadata: Metadata = {
  title: "Request a return",
  robots: { index: false },
}

export default async function ReturnRequestPage({
  params,
  searchParams,
}: PageProps<"/orders/[id]/return">) {
  const { id } = await params
  const { access, key } = await searchParams
  const orderKey = typeof key === "string" && key ? key : null
  const [order, options, reasons, customer] = await Promise.all([
    fetchOrderOnServer(id, orderKey),
    fetchReturnOptionsOnServer(id, orderKey),
    listReturnReasonsOnServer(),
    fetchCustomerOnServer(),
  ])

  if (!order || !options) {
    return <OrderLinkNeeded hadKey={Boolean(orderKey)} />
  }

  const back = (
    <Link
      href={orderPath(order.id, orderKey)}
      className="text-[13px] text-muted-foreground underline underline-offset-4 hover:text-foreground"
    >
      Back to order {formatOrderNumber(order.display_id)}
    </Link>
  )

  if (!options.eligibility.open) {
    return (
      <AccountShell title="Request a return">
        <p className="text-[15px] text-muted-foreground">
          Nothing in this order can be returned online right now. The order page
          explains why.
        </p>
        <div className="mt-6">{back}</div>
      </AccountShell>
    )
  }

  const items: ReturnableItem[] = options.eligibility.items
    .filter((eligible) => eligible.returnable_quantity > 0)
    .flatMap((eligible) => {
      const item = order.items?.find((line) => line.id === eligible.item_id)
      return item
        ? [
            {
              id: item.id,
              title: item.product_title ?? item.title,
              variant: item.variant_title ?? null,
              thumbnail: item.thumbnail ?? null,
              max: eligible.returnable_quantity,
              returnBy: eligible.return_by
                ? formatDate(eligible.return_by)
                : null,
            },
          ]
        : []
    })

  // The account that placed the order needs no further proof; a guest needs
  // the link emailed to the order's address. The backend checks the link.
  const ownsOrder =
    Boolean(customer) &&
    customer!.id === (order as { customer_id?: string | null }).customer_id
  const accessToken = typeof access === "string" && access ? access : null

  return (
    <AccountShell
      title="Request a return"
      intro={`Order ${formatOrderNumber(order.display_id)}. Choose what you're sending back and we'll be in touch to arrange collection or drop-off.`}
    >
      {ownsOrder || accessToken ? (
        <ReturnRequestForm
          orderId={order.id}
          orderKey={orderKey}
          items={items}
          reasons={reasons.map((reason) => ({
            id: reason.id,
            label: reason.label,
          }))}
          access={ownsOrder ? null : accessToken}
        />
      ) : (
        <ReturnAccessRequest orderId={order.id} />
      )}
      <div className="mt-10 border-t border-border/70 pt-6">{back}</div>
    </AccountShell>
  )
}
