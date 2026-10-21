import type { HttpTypes } from "@medusajs/types"
import type { StoreReturnOptionsResponse } from "@youjaymharah/api-types"
import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { notFound } from "next/navigation"

import { formatDate } from "@/components/orders/format"
import { Button } from "@/components/ui/button"
import {
  fetchOrderOnServer,
  fetchReturnOptionsOnServer,
} from "@/features/orders/server"
import {
  formatOrderNumber,
  getOrderProgress,
  getPaymentLabel,
  getReturnStatusLabel,
  getShipments,
  ORDER_STEPS,
  type OrderProgress,
  type Shipment,
} from "@/lib/medusa/order"
import { formatPrice } from "@/lib/medusa/price"
import { getStorefrontSettings } from "@/lib/medusa/storefront-settings"
import { orderReturnPath } from "@/lib/seo/routes"
import { cn } from "@/lib/util/cn"

export const metadata: Metadata = {
  title: "Your order",
  robots: { index: false },
}

type Order = HttpTypes.StoreOrder & {
  payment_status?: string
  fulfillment_status?: string
}

/**
 * An order's status, open to anyone with its link, as in the confirmation
 * email. Requesting a return asks for more proof than the link.
 */
export default async function OrderPage({
  params,
  searchParams,
}: PageProps<"/orders/[id]">) {
  const { id } = await params
  const justPlaced = (await searchParams).placed === "1"
  const [order, returns, settings] = await Promise.all([
    fetchOrderOnServer(id) as Promise<Order | null>,
    fetchReturnOptionsOnServer(id),
    getStorefrontSettings(),
  ])

  if (!order) {
    notFound()
  }

  const progress = getOrderProgress(order)
  const shipments = getShipments(order.fulfillments)
  const supportEmail = settings.brand.support_email

  return (
    <main className="container-wrapper max-w-3xl px-5 py-12 sm:px-6 sm:py-16">
      <p className="text-[13px] text-muted-foreground">
        Placed {formatDate(order.created_at)}
      </p>
      <h1 className="mt-1 text-2xl font-medium tracking-[-0.01em]">
        Order {formatOrderNumber(order.display_id)}
      </h1>

      {justPlaced && (
        <div role="status" className="mt-6 border-l-2 border-gold pl-3">
          <p className="text-[15px] font-medium">Thank you for your order.</p>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {getPaymentLabel(order.payment_status) === "Paid"
              ? `A confirmation is on its way to ${order.email}.`
              : `We'll confirm by email to ${order.email} once your payment arrives. Bank transfers can take a few minutes.`}{" "}
            Bookmark this page to follow your order.
          </p>
        </div>
      )}

      <ProgressSteps progress={progress} />

      {shipments.length > 0 && (
        <Section title="Shipments">
          <ul className="flex flex-col gap-4">
            {shipments.map((shipment, index) => (
              <ShipmentRow
                key={shipment.id}
                shipment={shipment}
                index={index}
                count={shipments.length}
                items={order.items ?? []}
              />
            ))}
          </ul>
        </Section>
      )}

      <Section title="Items">
        <ul className="divide-y divide-border/70">
          {(order.items ?? []).map((item) => (
            <li key={item.id} className="flex gap-4 py-4 first:pt-0">
              {item.thumbnail ? (
                <Image
                  src={item.thumbnail}
                  alt=""
                  width={64}
                  height={80}
                  className="aspect-4/5 w-16 shrink-0 bg-muted object-cover"
                />
              ) : (
                <div className="aspect-4/5 w-16 shrink-0 bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="text-[15px]">
                  {item.product_title ?? item.title}
                </p>
                {item.variant_title && (
                  <p className="mt-1 text-[13px] text-muted-foreground">
                    {item.variant_title}
                  </p>
                )}
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Qty {item.quantity}
                </p>
              </div>
              <p className="shrink-0 text-[13px] tabular-nums">
                {formatPrice(item.total ?? 0, order.currency_code)}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <div className="grid gap-x-10 sm:grid-cols-2">
        <Section title="Summary">
          <dl className="flex flex-col gap-2 text-[13px]">
            <SummaryRow
              label="Subtotal"
              value={formatPrice(order.item_subtotal ?? 0, order.currency_code)}
            />
            {Number(order.discount_total) > 0 && (
              <SummaryRow
                label="Discount"
                value={`−${formatPrice(order.discount_total, order.currency_code)}`}
              />
            )}
            <SummaryRow
              label="Delivery"
              value={formatPrice(
                order.shipping_total ?? 0,
                order.currency_code,
              )}
            />
            {Number(order.tax_total) > 0 && (
              <SummaryRow
                label="Tax"
                value={formatPrice(order.tax_total, order.currency_code)}
              />
            )}
            <SummaryRow
              label="Total"
              value={formatPrice(order.total, order.currency_code)}
              strong
            />
            <p className="pt-1 text-muted-foreground">
              {getPaymentLabel(order.payment_status)}
            </p>
          </dl>
        </Section>

        {order.shipping_address && (
          <Section title="Delivery address">
            <address className="text-[13px] leading-relaxed text-muted-foreground not-italic">
              {[
                [
                  order.shipping_address.first_name,
                  order.shipping_address.last_name,
                ]
                  .filter(Boolean)
                  .join(" "),
                order.shipping_address.address_1,
                order.shipping_address.address_2,
                [order.shipping_address.city, order.shipping_address.province]
                  .filter(Boolean)
                  .join(", "),
                order.shipping_address.phone,
              ]
                .filter(Boolean)
                .map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
            </address>
          </Section>
        )}
      </div>

      {progress.stage !== "canceled" && returns && (
        <ReturnsSection
          orderId={order.id}
          returns={returns}
          items={order.items ?? []}
          supportEmail={supportEmail}
        />
      )}

      {supportEmail && (
        <p className="mt-12 border-t border-border/70 pt-6 text-[13px] text-muted-foreground">
          Questions about this order? Email{" "}
          <a
            href={`mailto:${supportEmail}?subject=${encodeURIComponent(`Order ${formatOrderNumber(order.display_id)}`)}`}
            className="text-foreground underline underline-offset-4"
          >
            {supportEmail}
          </a>{" "}
          with your order number.
        </p>
      )}
    </main>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="mt-10">
      <h2 className="mb-4 border-b border-border/70 pb-3 text-[15px] font-medium">
        {title}
      </h2>
      {children}
    </section>
  )
}

function SummaryRow({
  label,
  value,
  strong,
}: {
  label: string
  value: string
  strong?: boolean
}) {
  return (
    <div
      className={cn(
        "flex justify-between gap-4",
        strong && "border-t border-border/70 pt-2 font-medium",
      )}
    >
      <dt>{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}

function ProgressSteps({ progress }: { progress: OrderProgress }) {
  if (progress.stage === "canceled") {
    return (
      <p className="mt-6 text-[15px]">
        This order was canceled. Any payment taken is refunded to the original
        payment method.
      </p>
    )
  }

  const current = ORDER_STEPS.findIndex((step) => step.stage === progress.stage)

  return (
    <div className="mt-8">
      <p className="text-[15px] font-medium">{progress.label}</p>
      <ol className="mt-4 grid grid-cols-4 gap-2">
        {ORDER_STEPS.map((step, index) => (
          <li
            key={step.stage}
            aria-current={index === current ? "step" : undefined}
            className="flex flex-col gap-2"
          >
            <span
              aria-hidden
              className={cn(
                "h-0.5 w-full",
                index < current || (index === current && !progress.partial)
                  ? "bg-foreground"
                  : index === current
                    ? "bg-foreground/35"
                    : "bg-border",
              )}
            />
            <span
              className={cn(
                "text-[12px]",
                index <= current ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </div>
  )
}

function ShipmentRow({
  shipment,
  index,
  count,
  items,
}: {
  shipment: Shipment
  index: number
  count: number
  items: HttpTypes.StoreOrderLineItem[]
}) {
  const names = shipment.itemIds
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is HttpTypes.StoreOrderLineItem => Boolean(item))
    .map((item) => item.product_title ?? item.title)

  return (
    <li className="text-[13px]">
      <p className="font-medium">
        {count > 1 ? `Shipment ${index + 1}: ` : ""}
        {shipment.deliveredAt
          ? `Delivered ${formatDate(shipment.deliveredAt)}`
          : `Sent ${formatDate(shipment.shippedAt)}`}
      </p>
      {count > 1 && names.length > 0 && (
        <p className="mt-1 text-muted-foreground">{names.join(", ")}</p>
      )}
      {shipment.tracking.map((label, labelIndex) => (
        <p key={labelIndex} className="mt-1 text-muted-foreground">
          {label.url ? (
            <a
              href={label.url}
              target="_blank"
              rel="noreferrer"
              className="text-foreground underline underline-offset-4"
            >
              Track {label.number ?? "shipment"}
            </a>
          ) : (
            `Tracking number ${label.number}`
          )}
        </p>
      ))}
    </li>
  )
}

function ReturnsSection({
  orderId,
  returns,
  items,
  supportEmail,
}: {
  orderId: string
  returns: StoreReturnOptionsResponse
  items: HttpTypes.StoreOrderLineItem[]
  supportEmail: string | null
}) {
  const { eligibility, return_policy: policy } = returns
  const nameOf = (itemId: string) => {
    const item = items.find((candidate) => candidate.id === itemId)
    return item?.product_title ?? item?.title ?? "An item"
  }
  const lastDay = eligibility.items
    .filter((item) => item.returnable_quantity > 0 && item.return_by)
    .map((item) => item.return_by!)
    .sort()
    .at(-1)

  let message: string | null = null
  switch (eligibility.reason) {
    case "disabled":
      message = supportEmail
        ? `To return something, email ${supportEmail} with your order number.`
        : "To return something, contact us with your order number."
      break
    case "not_shipped":
      message = "You can request a return once your order has been delivered."
      break
    case "expired":
      message = `The ${policy.window_days}-day return window for this order has closed.`
      break
    case "nothing_left":
      message = "Everything sent is already being returned."
      break
  }

  return (
    <Section title="Returns">
      {returns.returns.length > 0 && (
        <ul className="mb-5 flex flex-col gap-3">
          {returns.returns.map((item) => (
            <li key={item.id} className="text-[13px]">
              <p className="font-medium">
                {getReturnStatusLabel(item.status)} ·{" "}
                {formatDate(item.created_at)}
              </p>
              <p className="mt-1 text-muted-foreground">
                {item.items
                  .map(
                    (line) =>
                      `${nameOf(line.item_id)}${line.quantity > 1 ? ` × ${line.quantity}` : ""}`,
                  )
                  .join(", ")}
              </p>
              {item.status === "requested" && (
                <p className="mt-1 text-muted-foreground">
                  We&apos;ll be in touch to arrange collection or drop-off. Your
                  refund follows once the items reach us.
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
      {eligibility.open ? (
        <div className="flex flex-wrap items-center gap-4">
          <Button
            variant="outline"
            size="lg"
            nativeButton={false}
            render={<Link href={orderReturnPath(orderId)} />}
            className="px-4 tracking-[0.06em] uppercase"
          >
            Request a return
          </Button>
          {lastDay && (
            <p className="text-[13px] text-muted-foreground">
              Until {formatDate(lastDay)}
            </p>
          )}
        </div>
      ) : (
        message && (
          <p className="text-[13px] text-muted-foreground">{message}</p>
        )
      )}
    </Section>
  )
}
