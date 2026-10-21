import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { HelpPage } from "@/components/help/help-page"
import { PageText } from "@/components/help/page-text"
import { getContentPage } from "@/lib/medusa/storefront-settings"

export const metadata: Metadata = {
  title: "About us",
  description: "Who we are and what we make.",
}

/** Written in the admin under Settings › Pages; missing until it is. */
export default async function AboutPage() {
  const text = await getContentPage("about")
  if (!text) notFound()

  return (
    <HelpPage title="About us">
      <PageText text={text} />
    </HelpPage>
  )
}
