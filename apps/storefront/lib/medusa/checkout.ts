import { FetchError } from "@medusajs/js-sdk"
import type { HttpTypes } from "@medusajs/types"

/**
 * Checkout rules shared by the page and tests: which step a cart is on,
 * how payment options are named, and where a gateway sends the shopper.
 */

/** Medusa's built-in provider: takes orders without collecting money. */
export const TEST_PAYMENT_PROVIDER = "pp_system_default"

const PROVIDER_LABELS: Record<string, { label: string; detail: string }> = {
  pp_paystack_paystack: {
    label: "Pay with Paystack",
    detail: "Card, bank transfer or USSD",
  },
  pp_credo_credo: {
    label: "Pay with Credo",
    detail: "Card or bank transfer",
  },
  [TEST_PAYMENT_PROVIDER]: {
    label: "Test payment",
    detail: "Development only. No money is taken.",
  },
}

export function getPaymentOption(providerId: string) {
  return PROVIDER_LABELS[providerId] ?? { label: providerId, detail: "" }
}

/**
 * The payment options to offer. The test provider is hidden outside
 * development, so a store that forgot to remove it from the region still
 * can't take unpaid orders through the website.
 */
export function getPaymentOptions(
  providers: Pick<HttpTypes.StorePaymentProvider, "id">[],
  isDevelopment: boolean,
): string[] {
  return providers
    .map((provider) => provider.id)
    .filter((id) => isDevelopment || id !== TEST_PAYMENT_PROVIDER)
    .sort(
      (a, b) =>
        Number(a === TEST_PAYMENT_PROVIDER) -
          Number(b === TEST_PAYMENT_PROVIDER) ||
        Object.keys(PROVIDER_LABELS).indexOf(a) -
          Object.keys(PROVIDER_LABELS).indexOf(b),
    )
}

export type CheckoutStep = "details" | "delivery" | "payment"

type StepCart = Pick<HttpTypes.StoreCart, "email"> & {
  shipping_address?: Pick<
    HttpTypes.StoreCartAddress,
    "address_1" | "city"
  > | null
  shipping_methods?: unknown[] | null
}

/** The first step the shopper still has to finish. */
export function getCheckoutStep(cart: StepCart): CheckoutStep {
  if (
    !cart.email ||
    !cart.shipping_address?.address_1 ||
    !cart.shipping_address.city
  ) {
    return "details"
  }
  if (!cart.shipping_methods?.length) return "delivery"
  return "payment"
}

/**
 * The gateway's hosted payment page from the session Medusa just created, or
 * null when there is none (the test provider, or a gateway that failed).
 * Only https addresses are followed.
 */
export function getPaymentRedirectUrl(
  collection: Pick<HttpTypes.StorePaymentCollection, "payment_sessions">,
  providerId: string,
): string | null {
  const session = collection.payment_sessions?.find(
    (candidate) => candidate.provider_id === providerId,
  )
  const url = session?.data?.redirect_url
  return typeof url === "string" && /^https:\/\//i.test(url) ? url : null
}

/** Nigeria's states and the FCT, for the address form. */
export const NIGERIAN_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "FCT (Abuja)",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
] as const

/**
 * Why completing the cart failed, in words for the shopper. Medusa's own
 * messages are kept when they help (an item went out of stock); payment
 * failures, whose messages name internal session ids, are replaced.
 */
/**
 * Medusa answered, and no order was made: the gateway says the payment
 * failed or was canceled, or the cart can't become an order.
 */
export class PaymentNotCompletedError extends Error {}

/**
 * Whether a failed completion leaves the outcome unknown: the request timed
 * out, the network dropped, or the store or gateway didn't answer. The
 * money may have moved, so the shopper must not be told no order was
 * placed, nor invited to pay again. Completing again is safe: a completed
 * cart answers with its order.
 */
export function isUncertainCompletion(error: unknown): boolean {
  if (error instanceof PaymentNotCompletedError) return false
  if (error instanceof FetchError) {
    const status = error.status
    return (
      status === undefined ||
      status >= 500 ||
      status === 408 ||
      status === 409 ||
      status === 429
    )
  }
  // A network failure, before any answer.
  return true
}

export function describeCompletionError(
  message: string | null | undefined,
): string {
  if (
    !message ||
    /not authori[sz]ed|payment session|payment_session|payses_/i.test(message)
  ) {
    return "Your payment wasn't completed."
  }
  if (/inventory|stock|insufficient|quantity/i.test(message)) {
    return "Something in your bag sold out while you were paying."
  }
  return message
}

/** A cart line's price: its total when Medusa sent one, else price × quantity. */
export function getLineTotal(item: {
  total?: number | null
  unit_price?: number | null
  quantity?: number | null
}): number {
  const total = Number(item.total)
  return Number.isFinite(total) && total > 0
    ? total
    : Number(item.unit_price ?? 0) * Number(item.quantity ?? 0)
}
