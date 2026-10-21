"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { useCustomer } from "@/features/customer/hooks"
import { getBrowserSdk } from "@/lib/medusa/browser"
import type { PhotoUpload } from "@/lib/help/photos"

export type SupportStatus = "open" | "awaiting_customer" | "resolved"

export type SupportRequestSummary = {
  id: string
  reference: string
  kind: string
  status: SupportStatus
  order_id: string | null
  order_display_id: number | null
  created_at: string
  last_message_at: string
}

export type SupportMessage = {
  id: string
  author: "customer" | "staff"
  author_name: string | null
  body: string
  photos: { url: string; name: string }[]
  created_at: string
}

const requestsKey = ["support-requests"] as const

/** The signed-in customer's requests. Idle for guests. */
export function useSupportRequests() {
  const { data: customer } = useCustomer()
  return useQuery({
    queryKey: requestsKey,
    queryFn: async () =>
      (
        await getBrowserSdk().client.fetch<{
          requests: SupportRequestSummary[]
        }>("/store/support-requests")
      ).requests,
    enabled: Boolean(customer),
  })
}

export type OrderHelpKind =
  "order" | "cancel" | "change_address" | "exchange" | "damaged" | "missing"

export function useOrderHelp(orderId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      kind: OrderHelpKind
      message: string
      photos: PhotoUpload[]
    }) =>
      getBrowserSdk().client.fetch<{ reference: string; sent_to: string }>(
        `/store/orders/${encodeURIComponent(orderId)}/help`,
        { method: "POST", body },
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: requestsKey }),
  })
}

/** Answers on a request, as its owner or with the emailed `access` key. */
export function useReplyToRequest(requestId: string, access: string | null) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { body: string; photos: PhotoUpload[] }) =>
      (
        await getBrowserSdk().client.fetch<{ messages: SupportMessage[] }>(
          `/store/support-requests/${encodeURIComponent(requestId)}/messages`,
          {
            method: "POST",
            body: { ...body, ...(access ? { access } : {}) },
          },
        )
      ).messages,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: requestsKey }),
  })
}
