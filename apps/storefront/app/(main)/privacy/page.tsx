import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { HelpPage } from "@/components/help/help-page"
import { PageText } from "@/components/help/page-text"
import { getContentPage } from "@/lib/medusa/storefront-settings"

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How we collect, use and protect your personal data.",
}

/** Written in the admin under Settings › Pages; missing until it is. */
export default async function PrivacyPage() {
  const text = await getContentPage("privacy")
  if (!text) notFound()

  return (
    <HelpPage title="Privacy policy">
      <PageText text={text} />
    </HelpPage>
  )
}
