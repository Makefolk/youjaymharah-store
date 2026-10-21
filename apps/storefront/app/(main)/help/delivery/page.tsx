import type { Metadata } from "next"
import Link from "next/link"

import {
  HelpPage,
  HelpSection,
  helpLinkClass,
} from "@/components/help/help-page"
import { getStorefrontSettings } from "@/lib/medusa/storefront-settings"
import { CONTACT_PATH, TRACK_ORDER_PATH } from "@/lib/seo/routes"

export const metadata: Metadata = {
  title: "Delivery",
  description: "Where we deliver, how long it takes and how to track an order.",
}

/** The delivery text comes from Settings › Customer support. */
export default async function DeliveryPage() {
  const { support } = await getStorefrontSettings()
  const paragraphs = (support.delivery_information ?? "")
    .split(/\n\s*\n|\n/)
    .map((line) => line.trim())
    .filter(Boolean)

  return (
    <HelpPage
      title="Delivery"
      intro="The options and prices for your address are shown at checkout, before you pay."
    >
      {paragraphs.length > 0 && (
        <HelpSection title="Where we deliver and how long it takes">
          {paragraphs.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </HelpSection>
      )}

      <HelpSection title="Tracking your order">
        <p>
          When your order ships we email you the courier&apos;s tracking link.
          Your order page shows its progress too: open it from your confirmation
          email, or{" "}
          <Link href={TRACK_ORDER_PATH} className={helpLinkClass}>
            find it with your order number and email
          </Link>
          .
        </p>
      </HelpSection>

      <HelpSection title="Something not right?">
        <p>
          If your order is late or arrives damaged,{" "}
          <Link href={CONTACT_PATH} className={helpLinkClass}>
            message us
          </Link>{" "}
          with your order number.
        </p>
      </HelpSection>
    </HelpPage>
  )
}
