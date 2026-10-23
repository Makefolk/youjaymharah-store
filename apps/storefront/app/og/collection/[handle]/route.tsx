import { getCollectionByHandle, listProducts } from "@/lib/medusa/catalog"
import { getCollectionContent } from "@/lib/medusa/collection"
import { getStorefrontSettings } from "@/lib/medusa/storefront-settings"
import { loadFirstImage, loadImage } from "@/lib/og/assets"
import { Card, CardPanel, fit, PhotoMosaic, PriceLine } from "@/lib/og/cards"
import { getProductCardContent, lowestPrice, pieces } from "@/lib/og/content"
import { brandCard, renderCard, siteHost } from "@/lib/og/render"

/**
 * The link preview for a collection: its banner, or its first pieces side
 * by side, with how many there are and where prices start.
 */
export async function GET(
  _request: Request,
  context: RouteContext<"/og/collection/[handle]">,
) {
  const { handle } = await context.params
  const [collection, settings] = await Promise.all([
    getCollectionByHandle(handle),
    getStorefrontSettings(),
  ])
  if (!collection) return brandCard(settings)

  const content = getCollectionContent(collection)
  const { products, count } = await listProducts({
    collectionId: collection.id,
    limit: 3,
  })
  const banner = await loadImage(content.heroImage)
  const photos = banner
    ? [banner]
    : await Promise.all(
        products.map((product) =>
          loadFirstImage(
            getProductCardContent(product, false).photos.slice(0, 2),
          ),
        ),
      )
  const from = lowestPrice(products)

  return renderCard(
    <Card
      photos={<PhotoMosaic photos={photos} width={600} />}
      panel={
        <CardPanel
          width={600}
          brand={settings.brand.name}
          site={siteHost()}
          flag={count ? pieces(count) : null}
          title={fit(content.title, 48)}
          price={from && <PriceLine amount={from} from />}
          details={content.description ? fit(content.description, 90) : null}
          action="Shop the collection"
        />
      }
    />,
  )
}
