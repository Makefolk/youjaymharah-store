import { getProductByHandle } from "@/lib/medusa/catalog"
import { isNew } from "@/lib/medusa/product"
import { getStorefrontSettings } from "@/lib/medusa/storefront-settings"
import { loadFirstImage } from "@/lib/og/assets"
import { Card, CardPanel, fit, PhotoMosaic, PriceLine } from "@/lib/og/cards"
import { getProductCardContent } from "@/lib/og/content"
import { brandCard, renderCard, siteHost } from "@/lib/og/render"

/** The link preview for a product: its photo, price and a Buy now. */
export async function GET(
  _request: Request,
  context: RouteContext<"/og/product/[handle]">,
) {
  const { handle } = await context.params
  const [product, settings] = await Promise.all([
    getProductByHandle(handle),
    getStorefrontSettings(),
  ])
  if (!product) return brandCard(settings)

  const content = getProductCardContent(
    product,
    isNew(product, settings.products.new_badge_days),
  )
  // A 4:5 portrait, the shape of the store's product photos.
  const photo = await loadFirstImage(content.photos.slice(0, 3))

  return renderCard(
    <Card
      photos={<PhotoMosaic photos={[photo]} width={504} />}
      panel={
        <CardPanel
          width={696}
          brand={settings.brand.name}
          site={siteHost()}
          flag={content.flag}
          title={fit(product.title, 60)}
          price={content.price && <PriceLine {...content.price} />}
          details={content.details}
          action={content.action}
        />
      }
    />,
  )
}
