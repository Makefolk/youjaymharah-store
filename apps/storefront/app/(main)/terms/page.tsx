import type { Metadata } from "next"
import { notFound } from "next/navigation"

import { HelpPage } from "@/components/help/help-page"
import { PageText } from "@/components/help/page-text"
import { getContentPage } from "@/lib/medusa/storefront-settings"

export const metadata: Metadata = {
  title: "Terms of sale",
  description: "The terms that apply when you buy from us.",
}

/** Written in the admin under Settings › Pages; missing until it is. */
export default async function TermsPage() {
  const text = await getContentPage("terms")
  if (!text) notFound()

  return (
    <HelpPage title="Terms of sale">
      <PageText text={text} />
    </HelpPage>
  )
}
