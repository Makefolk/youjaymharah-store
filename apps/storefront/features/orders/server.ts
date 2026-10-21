import "server-only"

import type { HttpTypes } from "@medusajs/types"
import type { StoreReturnOptionsResponse } from "@youjaymharah/api-types"

import { isNotFound, isUnauthorized } from "@/lib/medusa/errors"
import { ORDER_LIST_FIELDS, ORDER_PAGE_FIELDS } from "@/lib/medusa/order"
import { getAuthHeaders, sdk } from "@/lib/medusa/server"

/**
 * Order reads for Server Components. Orders are per customer and change as
 * they ship, so none of these are cached.
 */

/** An order by id, or null. Needs no sign-in: the id is the key. */
export async function fetchOrderOnServer(
  id: string,
): Promise<HttpTypes.StoreOrder | null> {
  try {
    const { order } = await sdk.store.order.retrieve(id, {
      fields: ORDER_PAGE_FIELDS,
    })

    return order
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}

export const ORDERS_PAGE_SIZE = 20

/**
 * A page of the signed-in customer's orders, newest first, with the total;
 * null for a guest.
 */
export async function listCustomerOrdersOnServer(
  page = 1,
): Promise<{ orders: HttpTypes.StoreOrder[]; count: number } | null> {
  const headers = await getAuthHeaders()
  if (!headers.authorization) return null

  try {
    const { orders, count } = await sdk.store.order.list(
      {
        fields: ORDER_LIST_FIELDS,
        order: "-created_at",
        limit: ORDERS_PAGE_SIZE,
        offset: (Math.max(1, page) - 1) * ORDERS_PAGE_SIZE,
      },
      headers,
    )

    return { orders, count }
  } catch (error) {
    if (isUnauthorized(error)) return null
    throw error
  }
}

export async function fetchReturnOptionsOnServer(
  id: string,
): Promise<StoreReturnOptionsResponse | null> {
  try {
    return await sdk.client.fetch<StoreReturnOptionsResponse>(
      `/store/orders/${encodeURIComponent(id)}/return-options`,
      { cache: "no-store" },
    )
  } catch (error) {
    if (isNotFound(error)) return null
    throw error
  }
}

export async function listReturnReasonsOnServer(): Promise<
  HttpTypes.StoreReturnReason[]
> {
  const { return_reasons } =
    await sdk.client.fetch<HttpTypes.StoreReturnReasonListResponse>(
      "/store/return-reasons",
      { cache: "no-store" },
    )

  return return_reasons
}
