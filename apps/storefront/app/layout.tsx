import type { Metadata } from "next"
import { Bodoni_Moda, Instrument_Sans } from "next/font/google"
import { NuqsAdapter } from "nuqs/adapters/next/app"

import "./globals.css"
import { JsonLd } from "@/components/seo/json-ld"
import { getStorefrontSettings } from "@/lib/medusa/storefront-settings"
import { QueryProvider } from "@/lib/query/provider"
import { organizationJsonLd, websiteJsonLd } from "@/lib/seo/json-ld"
import { buildRootMetadata } from "@/lib/seo/metadata"
import { cn } from "@/lib/util/cn"
import { CatalogProvider } from "@/features/catalog/provider"
import { StorefrontSettingsProvider } from "@/features/site-settings/provider"
import { getCategoryTree, listCollections } from "@/lib/medusa/catalog"
import { getCollectionMenu, getMenuModel } from "@/lib/medusa/menu"
import { Toaster } from "@/components/ui/toaster"
import { TooltipProvider } from "@/components/ui/tooltip"

const bodoniModa = Bodoni_Moda({
  variable: "--font-bodoni",
  subsets: ["latin"],
  axes: ["opsz"],
})

const instrumentSans = Instrument_Sans({
  variable: "--font-instrument-sans",
  subsets: ["latin"],
})

/**
 * Site-wide title template, description, favicon, link previews, indexing and
 * Search Console verification, all from Settings › Storefront in the admin.
 */
export async function generateMetadata(): Promise<Metadata> {
  return buildRootMetadata(await getStorefrontSettings())
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [settings, categoryTree, collections] = await Promise.all([
    getStorefrontSettings(),
    getCategoryTree(),
    listCollections(),
  ])

  return (
    <html
      lang="en"
      className={cn(
        "antialiased",
        instrumentSans.variable,
        bodoniModa.variable,
      )}
    >
      <body className="flex min-h-dvh flex-col">
        <JsonLd
          data={[organizationJsonLd(settings), websiteJsonLd(settings)]}
        />
        <NuqsAdapter>
          <TooltipProvider>
            <QueryProvider>
              <StorefrontSettingsProvider settings={settings}>
                <CatalogProvider
                  menu={getMenuModel(categoryTree)}
                  collectionMenu={getCollectionMenu(
                    collections,
                    settings.homepage.featured_collection_id,
                  )}
                  storeMenuCards={settings.navigation.store_menu_cards}
                >
                  {children}
                </CatalogProvider>
              </StorefrontSettingsProvider>
              <Toaster />
            </QueryProvider>
          </TooltipProvider>
        </NuqsAdapter>
      </body>
    </html>
  )
}
