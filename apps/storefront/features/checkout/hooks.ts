"use client"

import type { HttpTypes } from "@medusajs/types"
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query"

import { getBrowserSdk } from "@/lib/medusa/browser"
import {
  getPaymentRedirectUrl,
  TEST_PAYMENT_PROVIDER,
} from "@/lib/medusa/checkout"
import { CURRENT_CART_ID } from "@/lib/medusa/constants"
import { queryKeys } from "@/lib/query/keys"

import type { CheckoutDetails } from "./schema"

type Cart = HttpTypes.StoreCart

const cartKey = queryKeys.cart.current()

export const checkoutQueries = {
  shippingOptions: (cartId: string) =>
    queryOptions({
      queryKey: queryKeys.cart.shippingOptions(cartId),
      queryFn: async () =>
        (
          await getBrowserSdk().store.fulfillment.listCartOptions({
            cart_id: cartId,
          })
        ).shipping_options,
    }),
  paymentProviders: (regionId: string) =>
    queryOptions({
      queryKey: queryKeys.paymentProviders.region(regionId),
      queryFn: async () =>
        (
          await getBrowserSdk().store.payment.listPaymentProviders({
            region_id: regionId,
          })
        ).payment_providers,
      staleTime: 5 * 60 * 1000,
    }),
}

export function useShippingOptions(cartId: string, enabled: boolean) {
  return useQuery({ ...checkoutQueries.shippingOptions(cartId), enabled })
}

export function usePaymentProviders(regionId: string | undefined) {
  return useQuery({
    ...checkoutQueries.paymentProviders(regionId ?? ""),
    enabled: Boolean(regionId),
  })
}

/** Saves the email and the delivery address, used for billing as well. */
export function useSaveCheckoutDetails() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (details: CheckoutDetails & { countryCode: string }) => {
      const address = {
        first_name: details.first_name.trim(),
        last_name: details.last_name.trim(),
        phone: details.phone.trim(),
        address_1: details.address_1.trim(),
        address_2: details.address_2.trim() || undefined,
        city: details.city.trim(),
        province: details.province,
        country_code: details.countryCode,
      }
      return (
        await getBrowserSdk().store.cart.update(CURRENT_CART_ID, {
          email: details.email.trim(),
          shipping_address: address,
          billing_address: address,
        })
      ).cart
    },
    onSuccess: (cart) => {
      queryClient.setQueryData(cartKey, cart)
      // Delivery prices can depend on the address.
      void queryClient.invalidateQueries({
        queryKey: queryKeys.cart.shippingOptions(cart.id),
      })
    },
  })
}

export function useSetShippingMethod() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (optionId: string) =>
      (
        await getBrowserSdk().store.cart.addShippingMethod(CURRENT_CART_ID, {
          option_id: optionId,
        })
      ).cart,
    onSuccess: (cart) => queryClient.setQueryData(cartKey, cart),
  })
}

export type PaymentStart =
  | { kind: "redirect"; url: string }
  | { kind: "order"; order: HttpTypes.StoreOrder }

/**
 * Starts paying. A fresh payment session is created every time, immediately
 * before leaving, so the gateway charges the current total even after a late
 * change. Gateways answer with their hosted page; the test provider has none,
 * so the cart is completed straight away.
 */
export function useStartPayment() {
  const completeCart = useCompleteCart()

  return useMutation({
    mutationFn: async ({
      cart,
      providerId,
      payer,
    }: {
      cart: Cart
      providerId: string
      payer: {
        email: string
        first_name?: string | null
        last_name?: string | null
        phone?: string | null
      }
    }): Promise<PaymentStart> => {
      const { payment_collection } =
        await getBrowserSdk().store.payment.initiatePaymentSession(cart, {
          provider_id: providerId,
          // Gateways need the shopper's contact details, which Medusa only
          // passes them for signed-in customers.
          data: { payer },
        })

      if (providerId === TEST_PAYMENT_PROVIDER) {
        return { kind: "order", order: await completeCart.mutateAsync() }
      }

      const url = getPaymentRedirectUrl(payment_collection, providerId)
      if (!url) {
        throw new Error(
          "The payment page couldn't be opened. Please try again or choose another way to pay.",
        )
      }
      return { kind: "redirect", url }
    },
  })
}

/**
 * Completes the cart, which makes Medusa verify the payment with the gateway
 * and create the order. Completing an already-completed cart returns the same
 * order, so a gateway webhook getting there first is fine. Throws with
 * Medusa's message when payment wasn't made.
 */
export function useCompleteCart() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (): Promise<HttpTypes.StoreOrder> => {
      const result = await getBrowserSdk().store.cart.complete(CURRENT_CART_ID)

      if (result.type === "order") {
        return result.order
      }
      throw new Error(
        result.error?.message ||
          "Your payment wasn't completed, so no order was placed.",
      )
    },
    onSuccess: () => {
      // The proxy has dropped the cart cookie; the next add starts a new bag.
      queryClient.setQueryData(cartKey, null)
    },
  })
}
