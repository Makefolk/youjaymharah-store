import type { NextRequest } from "next/server"

import { searchProducts } from "@/lib/medusa/catalog"
import { getStorefrontSettings } from "@/lib/medusa/storefront-settings"
import { loadFirstImage } from "@/lib/og/assets"
import { Card, CardPanel, fit, PhotoMosaic, PriceLine } from "@/lib/og/cards"
import { getProductCardContent, lowestPrice, pieces } from "@/lib/og/content"
import { brandCard, renderCard, siteHost } from "@/lib/og/render"

/** The longest term the catalogue accepts, as on the search page. */
const MAX_TERM = 128

/** The link preview for a search: the top results and how many there are. */
export async function GET(request: NextRequest) {
  const term = (request.nextUrl.searchParams.get("q") ?? "")
    .trim()
    .slice(0, MAX_TERM)
  const settings = await getStorefrontSettings()
  if (!term) return brandCard(settings)

  const { products, count } = await searchProducts({ q: term, limit: 3 })
  const photos = await Promise.all(
    products.map((product) =>
      loadFirstImage(getProductCardContent(product, false).photos.slice(0, 2)),
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
          flag={count ? `${pieces(count)} found` : null}
          title={`“${fit(term, 40)}”`}
          price={from && <PriceLine amount={from} from />}
          details={count ? null : "Explore the full collection"}
          action={count ? "See the results" : "Shop now"}
        />
      }
    />,
  )
}
