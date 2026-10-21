import { describe, expect, it } from "vitest"

import { orderLookupSchema } from "./schema"

describe("orderLookupSchema", () => {
  it("accepts the order number with or without its #", () => {
    expect(
      orderLookupSchema.parse({ order_number: " #1042 ", email: "a@b.co " }),
    ).toEqual({ order_number: 1042, email: "a@b.co" })
  })

  it("explains a malformed number", () => {
    const result = orderLookupSchema.safeParse({
      order_number: "ORD-1042",
      email: "a@b.co",
    })
    expect(result.success).toBe(false)
    expect(result.error?.issues[0].message).toMatch("like 1042")
  })
})
