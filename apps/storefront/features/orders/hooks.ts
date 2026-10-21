"use client"

import { useMutation } from "@tanstack/react-query"
import type {
  StoreOrderLookupBody,
  StoreOrderLookupResponse,
  StoreRequestReturnBody,
  StoreRequestReturnResponse,
} from "@youjaymharah/api-types"
import { useRouter } from "next/navigation"

import { getBrowserSdk } from "@/lib/medusa/browser"

/** Finds a guest's order from its number and email. 404 when either is wrong. */
export function useOrderLookup() {
  return useMutation({
    mutationFn: (body: StoreOrderLookupBody) =>
      getBrowserSdk().client.fetch<StoreOrderLookupResponse>(
        "/store/order-lookup",
        { method: "POST", body },
      ),
  })
}

/**
 * Emails the order's address a link that lets a guest request a return.
 * Resolves with where it went, partly hidden.
 */
export function useRequestReturnAccess(orderId: string) {
  return useMutation({
    mutationFn: () =>
      getBrowserSdk().client.fetch<{ sent_to: string }>(
        `/store/orders/${encodeURIComponent(orderId)}/return-access`,
        { method: "POST" },
      ),
  })
}

/**
 * Requests a return. Signed in, the proxy sends the customer's token; as a
 * guest, `access` is the token from the emailed return link. Refreshes the order page afterwards so
 * the request shows.
 */
export function useRequestReturn(orderId: string) {
  const router = useRouter()

  return useMutation({
    mutationFn: (body: StoreRequestReturnBody) =>
      getBrowserSdk().client.fetch<StoreRequestReturnResponse>(
        `/store/orders/${encodeURIComponent(orderId)}/return-requests`,
        { method: "POST", body },
      ),
    onSuccess: () => router.refresh(),
  })
}
