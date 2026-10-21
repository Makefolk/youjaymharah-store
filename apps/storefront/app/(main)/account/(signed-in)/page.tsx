import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

import { formatDate } from "@/components/orders/format"
import { fetchCustomerOnServer } from "@/features/customer/server"
import { listCustomerOrdersOnServer } from "@/features/orders/server"
import {
  formatOrderNumber,
  getOrderProgress,
  getPaymentLabel,
} from "@/lib/medusa/order"
import { formatPrice } from "@/lib/medusa/price"
import { orderPath } from "@/lib/seo/routes"

export const metadata: Metadata = {
  title: "Your account",
  robots: { index: false },
}

export default async function AccountPage() {
  // The layout has redirected guests already.
  const customer = (await fetchCustomerOnServer())!

  const orders = (await listCustomerOrdersOnServer()) ?? []

  return (
    <>
      <section aria-labelledby="account-orders" className="mt-8">
        <h2
          id="account-orders"
          className="border-b border-border/70 pb-3 text-[15px] font-medium"
        >
          Your orders
        </h2>
        {orders.length ? (
          <ul className="divide-y divide-border/70">
            {orders.map((order) => {
              const progress = getOrderProgress(order)
              const thumbnails = (order.items ?? [])
                .map((item) => item.thumbnail)
                .filter((url): url is string => Boolean(url))
                .slice(0, 3)

              return (
                <li key={order.id}>
                  <Link
                    href={orderPath(order.id)}
                    className="group flex items-center gap-4 py-5 outline-offset-4 focus-visible:outline-1"
                  >
                    <div className="flex shrink-0 -space-x-3">
                      {thumbnails.length ? (
                        thumbnails.map((url) => (
                          <Image
                            key={url}
                            src={url}
                            alt=""
                            width={48}
                            height={60}
                            className="aspect-4/5 w-12 border border-background bg-muted object-cover"
                          />
                        ))
                      ) : (
                        <div className="aspect-4/5 w-12 bg-muted" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-medium">
                        Order {formatOrderNumber(order.display_id)}
                      </p>
                      <p className="mt-1 text-[13px] text-muted-foreground">
                        {formatDate(order.created_at)} · {progress.label}
                        {progress.stage === "placed" &&
                        getPaymentLabel(
                          (order as { payment_status?: string }).payment_status,
                        ) === "Awaiting payment"
                          ? " · Awaiting payment"
                          : ""}
                      </p>
                    </div>
                    <p className="shrink-0 text-[13px] tabular-nums">
                      {formatPrice(order.total, order.currency_code)}
                    </p>
                  </Link>
                </li>
              )
            })}
          </ul>
        ) : (
          <p className="py-6 text-[15px] text-muted-foreground">
            You haven&apos;t ordered with this account yet. Orders placed as a
            guest with {customer.email} appear here once the email is verified.
          </p>
        )}
      </section>
    </>
  )
}
