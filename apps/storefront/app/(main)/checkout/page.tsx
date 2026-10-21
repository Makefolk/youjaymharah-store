import { dehydrate, HydrationBoundary } from "@tanstack/react-query"
import type { Metadata } from "next"
import { redirect } from "next/navigation"

import { cartQueries } from "@/features/cart/queries"
import { fetchCartOnServer } from "@/features/cart/server"
import { customerQueries } from "@/features/customer/queries"
import { fetchCustomerOnServer } from "@/features/customer/server"
import { getQueryClient } from "@/lib/query/client"
import { SHOPPING_BAG_PATH } from "@/lib/seo/routes"

import { CheckoutFlow } from "./checkout-flow"

export const metadata: Metadata = {
  title: "Checkout",
  robots: { index: false },
}

export default async function CheckoutPage({
  searchParams,
}: PageProps<"/checkout">) {
  const queryClient = getQueryClient()
  const [cart] = await Promise.all([
    queryClient.fetchQuery({
      ...cartQueries.current(),
      queryFn: fetchCartOnServer,
    }),
    queryClient.prefetchQuery({
      ...customerQueries.me(),
      queryFn: fetchCustomerOnServer,
    }),
  ])

  if (!cart?.items?.length) {
    redirect(SHOPPING_BAG_PATH)
  }

  const { payment } = await searchParams

  return (
    <main className="container-wrapper px-5 py-10 sm:px-6 lg:px-12">
      <h1 className="text-2xl font-medium tracking-[-0.01em]">Checkout</h1>
      <HydrationBoundary state={dehydrate(queryClient)}>
        <CheckoutFlow
          paymentProblem={typeof payment === "string" ? payment : null}
        />
      </HydrationBoundary>
    </main>
  )
}
