import type { Metadata } from "next"

import { dehydrate, HydrationBoundary } from "@tanstack/react-query"

import { cartQueries } from "@/features/cart/queries"
import { fetchCartOnServer } from "@/features/cart/server"
import { getQueryClient } from "@/lib/query/client"

import { BagView } from "./bag-view"

export const metadata: Metadata = {
  title: "Shopping bag",
  robots: { index: false },
}

const RESTORE_MESSAGES: Record<string, string> = {
  expired:
    "That link has expired. Your bag may already have been checked out or cleared.",
  invalid: "That link isn't complete. Try opening it from the email again.",
  failed:
    "We couldn't bring your bag back just now. Please try the link again in a moment.",
}

export default async function CartPage({
  searchParams,
}: PageProps<"/shopping-bag">) {
  const { restore } = await searchParams
  const message =
    typeof restore === "string" ? RESTORE_MESSAGES[restore] : undefined

  const queryClient = getQueryClient()
  await queryClient.prefetchQuery({
    ...cartQueries.current(),
    queryFn: fetchCartOnServer,
  })

  return (
    <main className="container-wrapper px-5 pt-8 pb-16 sm:px-6 lg:px-12 lg:pt-12 lg:pb-24">
      <h1 className="text-2xl font-medium tracking-[-0.01em]">Shopping bag</h1>

      {message && (
        <p
          role="status"
          className="mt-4 border-l-2 border-gold pl-3 text-[15px]"
        >
          {message}
        </p>
      )}

      <HydrationBoundary state={dehydrate(queryClient)}>
        <BagView />
      </HydrationBoundary>
    </main>
  )
}
