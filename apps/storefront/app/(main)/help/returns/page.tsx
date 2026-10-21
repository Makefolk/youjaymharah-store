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
  title: "Returns and refunds",
  description: "How to return something and when your refund arrives.",
}

/** Built from Settings › Returns, so it always matches what customers can do. */
export default async function ReturnsPolicyPage() {
  const { returns } = await getStorefrontSettings()
  const days = `${returns.window_days} ${returns.window_days === 1 ? "day" : "days"}`

  return (
    <HelpPage
      title="Returns and refunds"
      intro={
        returns.enabled
          ? `Changed your mind? You can return items within ${days} of delivery.`
          : "To return something, message us with your order number and we'll arrange it with you."
      }
    >
      {returns.enabled && (
        <HelpSection title="How to return something">
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Open your order from your confirmation email, your account, or{" "}
              <Link href={TRACK_ORDER_PATH} className={helpLinkClass}>
                with your order number and email
              </Link>
              .
            </li>
            <li>
              Choose <span className="text-foreground">Request a return</span>,
              pick the items and tell us why. If you checked out as a guest,
              we&apos;ll first email you a link to confirm the order is yours.
            </li>
            <li>
              We&apos;ll be in touch to arrange collection or drop-off, and
              email you when the items arrive.
            </li>
          </ol>
        </HelpSection>
      )}

      {returns.enabled && (
        <HelpSection title="The return window">
          <p>
            Each delivery has its own {days}, counted from the day it&apos;s
            delivered. If we couldn&apos;t confirm the delivery, they count from
            the day it was sent. Your order page shows the last day to request
            each item.
          </p>
        </HelpSection>
      )}

      <HelpSection title="Refunds">
        <p>
          Once the items reach us and we&apos;ve checked them, we refund to the
          way you paid and email you. Your bank may take a few working days to
          show it.
        </p>
      </HelpSection>

      <HelpSection title="Exchanges, faulty or missing items">
        <p>
          For a different size, or if something arrived damaged, wrong or
          missing,{" "}
          <Link href={CONTACT_PATH} className={helpLinkClass}>
            message us
          </Link>{" "}
          with your order number and we&apos;ll put it right.
        </p>
      </HelpSection>
    </HelpPage>
  )
}
