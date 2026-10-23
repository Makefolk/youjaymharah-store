import { Metadata } from "next"

// import { listCartOptions, retrieveCart } from "@lib/data/cart"
// import { retrieveCustomer } from "@lib/data/customer"
// import { getBaseURL } from "@lib/util/env"
// import { StoreCartShippingOption } from "@medusajs/types"
import { Header } from "@/components/layout/header"
import { AnnouncementBanner } from "@/components/layout/announcement-banner"
import { HeaderOverlayProvider } from "@/features/layout/header-overlay"
import { getBaseURL } from "@/lib/util/env"
import { Footer } from "@/components/layout/footer"
import { NewsletterSignup } from "@/components/newsletter/newsletter-signup"
// import CartMismatchBanner from "@modules/layout/components/cart-mismatch-banner"
// import Footer from "@modules/layout/templates/footer"
// import Nav from "@modules/layout/templates/nav"
// import FreeShippingPriceNudge from "@modules/shipping/components/free-shipping-price-nudge"

export const metadata: Metadata = {
  metadataBase: new URL(getBaseURL()),
}

export default async function PageLayout(
  props: LayoutProps<"/"> & { quickView: React.ReactNode },
) {
  return (
    <HeaderOverlayProvider>
      <AnnouncementBanner />

      <Header />
      <main className="flex-1">{props.children}</main>
      {props.quickView}

      <NewsletterSignup source="footer" />
      <Footer />
    </HeaderOverlayProvider>
  )
}
