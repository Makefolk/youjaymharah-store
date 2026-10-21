import { describe, expect, it } from "vitest"

import { checkoutDetailsSchema } from "./schema"

const valid = {
  email: " ada@example.com ",
  first_name: "Ada",
  last_name: "Obi",
  phone: "0803 123 4567",
  address_1: "12 Admiralty Way",
  address_2: "",
  city: "Lekki",
  province: "Lagos",
}

describe("checkoutDetailsSchema", () => {
  it("accepts a Nigerian address and trims the email", () => {
    expect(checkoutDetailsSchema.parse(valid).email).toBe("ada@example.com")
    expect(
      checkoutDetailsSchema.safeParse({ ...valid, phone: "+234 803 123 4567" })
        .success,
    ).toBe(true)
  })

  it("asks for the phone number and state", () => {
    const result = checkoutDetailsSchema.safeParse({
      ...valid,
      phone: "call me",
      province: "",
    })
    expect(result.error?.issues.map((issue) => issue.path[0])).toEqual([
      "phone",
      "province",
    ])
  })
})
