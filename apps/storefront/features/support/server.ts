import "server-only"

import { isNotFound } from "@/lib/medusa/errors"
import { getAuthHeaders, sdk } from "@/lib/medusa/server"

import type { SupportMessage, SupportRequestSummary } from "./hooks"

export type SupportRequestDetail = SupportRequestSummary & {
  messages: SupportMessage[]
}

/**
 * A request for its signed-in owner, or with the key from its email link.
 * Null when it doesn't exist or isn't theirs (the backend doesn't say which).
 */
export async function fetchSupportRequestOnServer(
  id: string,
  access: string | null,
): Promise<SupportRequestDetail | null> {
  try {
    const { request } = await sdk.client.fetch<{
      request: SupportRequestDetail
    }>(`/store/support-requests/${encodeURIComponent(id)}`, {
      query: access ? { access } : {},
      headers: await getAuthHeaders(),
      cache: "no-store",
    })
    return request
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}
