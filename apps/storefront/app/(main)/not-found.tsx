import type { Metadata } from "next"
import Link from "next/link"

import { CONTACT_PATH, SEARCH_PATH } from "@/lib/seo/routes"

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
}

export default function NotFound() {
  return (
    <main className="container-wrapper flex max-w-md flex-col gap-4 px-5 py-20 sm:px-6">
      <h1 className="text-2xl font-medium tracking-[-0.01em]">
        We can&apos;t find that page
      </h1>
      <p className="text-[15px] text-muted-foreground">
        It may have moved, or the piece may no longer be available.
      </p>
      <div className="mt-2 flex flex-wrap gap-5 text-[13px]">
        <Link href="/" className="underline underline-offset-4">
          Go to the home page
        </Link>
        <Link href={SEARCH_PATH} className="underline underline-offset-4">
          Search the store
        </Link>
        <Link href={CONTACT_PATH} className="underline underline-offset-4">
          Contact us
        </Link>
      </div>
    </main>
  )
}
