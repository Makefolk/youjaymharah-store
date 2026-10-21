"use client"

import { useQuery } from "@tanstack/react-query"
import Image from "next/image"
import Link from "next/link"

import { formatDate } from "@/components/orders/format"
import { toast } from "@/components/ui/toaster"
import {
  useCancelProductAlert,
  useProductAlerts,
} from "@/features/product-alerts/hooks"
import { getBrowserSdk } from "@/lib/medusa/browser"
import { productPath } from "@/lib/seo/routes"

/** Every "Notify me" the customer has set, with a way to stop each one. */
export function StockAlerts() {
  const alerts = useProductAlerts()
  const cancel = useCancelProductAlert()
  const waiting = (alerts.data ?? []).filter(
    (alert) => alert.status === "waiting",
  )
  const ids = [...new Set(waiting.map((alert) => alert.product_id))]

  const products = useQuery({
    queryKey: ["alert-products", ids],
    queryFn: async () =>
      (
        await getBrowserSdk().store.product.list({
          id: ids,
          limit: ids.length,
          fields: "id,title,handle,thumbnail",
        })
      ).products,
    enabled: ids.length > 0,
  })
  const byId = new Map((products.data ?? []).map((p) => [p.id, p]))

  if (alerts.isPending) {
    return <p className="text-[13px] text-muted-foreground">Loading…</p>
  }
  if (!waiting.length) {
    return (
      <p className="text-[15px] text-muted-foreground">
        No alerts set. Tap the bell on a sold-out or coming-soon piece and
        we&apos;ll email you when it&apos;s available.
      </p>
    )
  }

  return (
    <ul className="divide-y divide-border/70">
      {waiting.map((alert) => {
        const product = byId.get(alert.product_id)
        return (
          <li key={alert.id} className="flex items-center gap-4 py-4">
            <div className="relative aspect-4/5 w-12 shrink-0 bg-muted">
              {product?.thumbnail && (
                <Image
                  src={product.thumbnail}
                  alt=""
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {product ? (
                <Link
                  href={productPath(product.handle)}
                  className="text-[15px] font-medium hover:underline hover:underline-offset-4"
                >
                  {product.title}
                </Link>
              ) : (
                <span className="text-[15px] text-muted-foreground">
                  A piece no longer on sale
                </span>
              )}
              <p className="mt-1 text-[13px] text-muted-foreground">
                {alert.reason === "launch"
                  ? "When it launches"
                  : "When it's back"}{" "}
                · set {formatDate(alert.created_at)}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                cancel.mutate(alert.id, {
                  onSuccess: () => toast.info("Alert cancelled"),
                  onError: () => toast.error("Couldn't cancel the alert"),
                })
              }
              className="shrink-0 text-[13px] underline underline-offset-4"
            >
              Cancel
            </button>
          </li>
        )
      })}
    </ul>
  )
}
