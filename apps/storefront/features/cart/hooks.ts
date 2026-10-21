"use client"

import type { HttpTypes } from "@medusajs/types"
import {
  type QueryClient,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import { getBrowserSdk } from "@/lib/medusa/browser"
import { CURRENT_CART_ID } from "@/lib/medusa/constants"
import { isNotFound } from "@/lib/medusa/errors"
import { queryKeys } from "@/lib/query/keys"

import { cartQueries } from "./queries"

type Cart = HttpTypes.StoreCart

/** Every cart write shares this key, so they can tell whether others are in flight. */
const CART_MUTATION_KEY = ["cart"] as const

const cartKey = queryKeys.cart.current()

/**
 * Writes a server response into the cache, unless another cart change is still
 * running. Quantity taps run in parallel and can answer out of order; only the
 * last one to settle may overwrite what the others optimistically showed.
 */
function settleCart(queryClient: QueryClient, cart: Cart | undefined): void {
  if (!cart) {
    return
  }

  if (queryClient.isMutating({ mutationKey: CART_MUTATION_KEY }) === 1) {
    queryClient.setQueryData(cartKey, cart)
  }
}

export function useCart() {
  return useQuery(cartQueries.current())
}

type AddToCartInput = {
  variantId: string
  quantity?: number
  /** Only used when a cart has to be created; defaults to the store's region. */
  regionId?: string
}

/**
 * Adds a variant, creating the cart first when there is none. Not optimistic:
 * a new line's price, tax and promotions only exist once Medusa calculates
 * them, so the cart updates when the response arrives.
 */
export function useAddToCart() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: CART_MUTATION_KEY,
    mutationFn: async ({
      variantId,
      quantity = 1,
      regionId,
    }: AddToCartInput): Promise<Cart> => {
      const sdk = getBrowserSdk()
      const line = { variant_id: variantId, quantity }
      const createCart = () =>
        sdk.store.cart.create(regionId ? { region_id: regionId } : {})

      // The proxy stores a created cart's id, so "current" works right after.
      if (!(await queryClient.fetchQuery(cartQueries.current()))) {
        await createCart()
      }

      try {
        return (await sdk.store.cart.createLineItem(CURRENT_CART_ID, line)).cart
      } catch (error) {
        if (!isNotFound(error)) {
          throw error
        }

        // The cookie's cart was completed or deleted in the meantime.
        await createCart()

        return (await sdk.store.cart.createLineItem(CURRENT_CART_ID, line)).cart
      }
    },
    onSettled: (cart) => settleCart(queryClient, cart),
  })
}

type UpdateLineItemInput = { lineItemId: string; quantity: number }

/**
 * Changes a line's quantity optimistically and rolls back if Medusa refuses
 * (e.g. out of stock). Only the quantity changes straight away; totals follow
 * with the response, because Medusa calculates tax and promotions.
 */
export function useUpdateLineItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: CART_MUTATION_KEY,
    mutationFn: async ({
      lineItemId,
      quantity,
    }: UpdateLineItemInput): Promise<Cart> =>
      (
        await getBrowserSdk().store.cart.updateLineItem(
          CURRENT_CART_ID,
          lineItemId,
          { quantity },
        )
      ).cart,
    onMutate: async ({ lineItemId, quantity }) => {
      await queryClient.cancelQueries({ queryKey: cartKey })

      const previous = queryClient.getQueryData<Cart | null>(cartKey)

      queryClient.setQueryData<Cart | null>(cartKey, (cart) =>
        cart
          ? {
              ...cart,
              items: cart.items?.map((item) =>
                item.id === lineItemId ? { ...item, quantity } : item,
              ),
            }
          : cart,
      )

      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context) {
        queryClient.setQueryData(cartKey, context.previous)
      }
    },
    onSettled: (cart) => settleCart(queryClient, cart),
  })
}

/** Removes a line optimistically and rolls back if Medusa refuses. */
export function useRemoveLineItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: CART_MUTATION_KEY,
    mutationFn: async (lineItemId: string): Promise<Cart | undefined> =>
      (
        await getBrowserSdk().store.cart.deleteLineItem(
          CURRENT_CART_ID,
          lineItemId,
        )
      ).parent,
    onMutate: async (lineItemId) => {
      await queryClient.cancelQueries({ queryKey: cartKey })

      const previous = queryClient.getQueryData<Cart | null>(cartKey)

      queryClient.setQueryData<Cart | null>(cartKey, (cart) =>
        cart
          ? {
              ...cart,
              items: cart.items?.filter((item) => item.id !== lineItemId),
            }
          : cart,
      )

      return { previous }
    },
    onError: (_error, _input, context) => {
      if (context) {
        queryClient.setQueryData(cartKey, context.previous)
      }
    },
    onSettled: (cart) => {
      if (cart) {
        settleCart(queryClient, cart)
      } else {
        // The delete response did not include the cart; fetch it.
        void queryClient.invalidateQueries({ queryKey: cartKey })
      }
    },
  })
}

/**
 * Applies a promo code. Medusa ignores a code it doesn't recognise rather
 * than failing, so the caller checks whether it appears on the cart.
 */
export function useApplyPromoCode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: CART_MUTATION_KEY,
    mutationFn: async (code: string): Promise<Cart> =>
      (
        await getBrowserSdk().client.fetch<{ cart: Cart }>(
          `/store/carts/${CURRENT_CART_ID}/promotions`,
          { method: "POST", body: { promo_codes: [code] } },
        )
      ).cart,
    onSettled: (cart) => settleCart(queryClient, cart),
  })
}

export function useRemovePromoCode() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationKey: CART_MUTATION_KEY,
    mutationFn: async (code: string): Promise<Cart> =>
      (
        await getBrowserSdk().client.fetch<{ cart: Cart }>(
          `/store/carts/${CURRENT_CART_ID}/promotions`,
          { method: "DELETE", body: { promo_codes: [code] } },
        )
      ).cart,
    onSettled: (cart) => settleCart(queryClient, cart),
  })
}
