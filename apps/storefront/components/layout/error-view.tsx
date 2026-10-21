"use client"

import * as Sentry from "@sentry/nextjs"
import Link from "next/link"
import { useEffect, type ReactNode } from "react"

import { primaryButtonClass } from "@/components/account/account-shell"
import { Button } from "@/components/ui/button"
import { CONTACT_PATH } from "@/lib/seo/routes"

/**
 * What a route's error boundary shows: a way to try again, and a reference
 * the shopper can quote to support (the same digest the server logged).
 */
export function ErrorView({
  error,
  reset,
  children,
}: {
  error: Error & { digest?: string }
  reset: () => void
  children?: ReactNode
}) {
  useEffect(() => {
    Sentry.captureException(error)
  }, [error])

  return (
    <main className="container-wrapper flex max-w-md flex-col gap-4 px-5 py-20 sm:px-6">
      <h1 className="text-2xl font-medium tracking-[-0.01em]">
        Something went wrong
      </h1>
      <p className="text-[15px] text-muted-foreground">
        This page didn&apos;t load properly. It&apos;s usually brief: try again
        in a moment.
      </p>
      {children}
      <div className="mt-2 flex flex-wrap items-center gap-5">
        <Button size="lg" onClick={reset} className={primaryButtonClass}>
          Try again
        </Button>
        <Link href="/" className="text-[13px] underline underline-offset-4">
          Go to the home page
        </Link>
      </div>
      <p className="mt-6 text-[13px] text-muted-foreground">
        Still not working?{" "}
        <Link
          href={CONTACT_PATH}
          className="text-foreground underline underline-offset-4"
        >
          Tell us
        </Link>
        {error.digest ? ` and mention reference ${error.digest}.` : "."}
      </p>
    </main>
  )
}
