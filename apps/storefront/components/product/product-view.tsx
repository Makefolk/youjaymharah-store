"use client"

import type { HttpTypes } from "@medusajs/types"
import type { StoreSizeGuide } from "@youjaymharah/api-types"

import { useProductSelection } from "@/features/product-selection/use-product-selection"
import { getProductDetails } from "@/lib/medusa/product-page"
import { getProductCardImages } from "@/lib/medusa/variants"

import { ProductGallery } from "./product-gallery"
import { ProductPurchase } from "./product-purchase"
import { SizeGuideDialog } from "./size-guide-dialog"

/**
 * The product page's interactive part. Reads the chosen options from the
 * URL, so render it inside <Suspense>.
 */
export function ProductView({
  product,
  sizeGuide,
  isNew,
  returns,
  supportEmail,
}: {
  product: HttpTypes.StoreProduct
  sizeGuide: StoreSizeGuide | null
  isNew: boolean
  returns: { enabled: boolean; window_days: number }
  supportEmail: string | null
}) {
  const { selection, variant, setOption } = useProductSelection(product)
  const images = getProductCardImages(product, selection)
  const details = getProductDetails(product)

  return (
    <div className="grid gap-8 md:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14">
      <ProductGallery
        key={images.map((image) => image.url).join("|")}
        images={images}
        title={product.title}
      />

      <div className="md:sticky md:top-24 md:self-start">
        <ProductPurchase
          product={product}
          selection={selection}
          variant={variant}
          onSelect={setOption}
          thumbnail={images[0]?.url ?? null}
          isNew={isNew}
          sizeGuide={(size) =>
            sizeGuide ? (
              <SizeGuideDialog guide={sizeGuide} selectedSize={size} />
            ) : null
          }
        />

        <div className="mt-10 border-t border-border">
          {product.description && (
            <Section title="Description" open>
              <p className="max-w-[65ch] whitespace-pre-line">
                {product.description}
              </p>
            </Section>
          )}
          {details.length > 0 && (
            <Section title="Details and care">
              <dl className="grid gap-3">
                {details.map((detail) => (
                  <div key={detail.label}>
                    <dt className="font-medium text-foreground">
                      {detail.label}
                    </dt>
                    <dd>{detail.value}</dd>
                  </div>
                ))}
              </dl>
            </Section>
          )}
          <Section title="Delivery and returns">
            <p>
              We deliver across Nigeria. Delivery options and prices are shown
              at checkout.
            </p>
            <p className="mt-2">
              {returns.enabled
                ? `Changed your mind? Request a return from your order page within ${returns.window_days} days of delivery (counted from dispatch if we couldn't confirm delivery). Your order page shows the exact date for each item.`
                : `To return something, contact us${supportEmail ? ` at ${supportEmail}` : ""} with your order number.`}
            </p>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({
  title,
  open,
  children,
}: {
  title: string
  open?: boolean
  children: React.ReactNode
}) {
  return (
    <details open={open} className="group border-b border-border">
      <summary className="flex cursor-pointer list-none items-center justify-between py-4 text-[13px] font-medium [&::-webkit-details-marker]:hidden">
        {title}
        <span
          aria-hidden
          className="text-lg leading-none transition-transform group-open:rotate-45"
        >
          +
        </span>
      </summary>
      <div className="pb-5 text-[13px] leading-relaxed text-muted-foreground">
        {children}
      </div>
    </details>
  )
}
