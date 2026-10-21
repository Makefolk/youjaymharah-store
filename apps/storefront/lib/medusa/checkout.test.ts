import { describe, expect, it } from "vitest"

import {
  describeCompletionError,
  getCheckoutStep,
  getLineTotal,
  getPaymentOptions,
  getPaymentRedirectUrl,
  NIGERIAN_STATES,
} from "./checkout"

describe("getPaymentOptions", () => {
  const providers = [
    { id: "pp_system_default" },
    { id: "pp_credo_credo" },
    { id: "pp_paystack_paystack" },
  ]

  it("offers the gateways, Paystack first, and hides the test provider in production", () => {
    expect(getPaymentOptions(providers, false)).toEqual([
      "pp_paystack_paystack",
      "pp_credo_credo",
    ])
  })

  it("lists the test provider last in development", () => {
    expect(getPaymentOptions(providers, true).at(-1)).toBe("pp_system_default")
  })
})

describe("getCheckoutStep", () => {
  it("moves on as details and delivery are filled in", () => {
    expect(getCheckoutStep({ email: undefined })).toBe("details")
    expect(
      getCheckoutStep({
        email: "a@b.co",
        shipping_address: { address_1: "1 Road", city: "Lagos" },
      }),
    ).toBe("delivery")
    expect(
      getCheckoutStep({
        email: "a@b.co",
        shipping_address: { address_1: "1 Road", city: "Lagos" },
        shipping_methods: [{}],
      }),
    ).toBe("payment")
  })
})

describe("getPaymentRedirectUrl", () => {
  it("follows only the chosen provider's https page", () => {
    const collection = {
      payment_sessions: [
        {
          provider_id: "pp_credo_credo",
          data: { redirect_url: "https://pay.credo/x" },
        },
        {
          provider_id: "pp_paystack_paystack",
          data: { redirect_url: "javascript:alert(1)" },
        },
      ],
    } as never

    expect(getPaymentRedirectUrl(collection, "pp_credo_credo")).toBe(
      "https://pay.credo/x",
    )
    expect(getPaymentRedirectUrl(collection, "pp_paystack_paystack")).toBeNull()
    expect(getPaymentRedirectUrl(collection, "pp_system_default")).toBeNull()
  })
})

it("lists all 36 states and the FCT", () => {
  expect(NIGERIAN_STATES).toHaveLength(37)
})

describe("describeCompletionError", () => {
  it("hides internal payment session messages", () => {
    expect(
      describeCompletionError(
        "Session: payses_01M5 was not authorized with the provider.",
      ),
    ).toBe("Your payment wasn't completed.")
  })

  it("explains stock problems and keeps other messages", () => {
    expect(
      describeCompletionError(
        "Variant var_1 does not have the required inventory",
      ),
    ).toMatch("sold out")
    expect(describeCompletionError("Cart has no shipping method")).toBe(
      "Cart has no shipping method",
    )
  })
})

it("falls back to price × quantity when a line has no total", () => {
  expect(getLineTotal({ unit_price: 1500, quantity: 2 })).toBe(3000)
  expect(getLineTotal({ total: 2800, unit_price: 1500, quantity: 2 })).toBe(
    2800,
  )
})
