import { describe, expect, it } from "vitest"

import { newsletterSignupSchema, newsletterConfirmSchema } from "./schema"

const errorFor = (email: string) =>
  newsletterSignupSchema.safeParse({ email }).error?.issues[0]?.message

describe("newsletterSignupSchema", () => {
  it("asks for an address when the field is empty or only spaces", () => {
    expect(errorFor("")).toBe("Enter your email address.")
    expect(errorFor("   ")).toBe("Enter your email address.")
  })

  it("explains what a valid address looks like", () => {
    expect(errorFor("name@")).toBe(
      "Enter a valid email address, like name@example.com.",
    )
    expect(errorFor("not an email")).toBe(
      "Enter a valid email address, like name@example.com.",
    )
  })

  it("accepts a pasted address with stray whitespace", () => {
    const result = newsletterSignupSchema.safeParse({
      email: "  ada@example.com ",
    })

    expect(result.success).toBe(true)
    expect(result.data?.email).toBe("ada@example.com")
  })
})

describe("newsletterConfirmSchema", () => {
  it.each(["", "   ", "a".repeat(101)])(
    "rejects an invalid first name",
    (first_name) => {
      expect(newsletterConfirmSchema.safeParse({ first_name }).success).toBe(
        false,
      )
    },
  )

  it.each(["Ada", "Ọlá", "Anne-Marie", "D’Arcy", "Mary Jane"])(
    "accepts and trims %s",
    (first_name) => {
      expect(
        newsletterConfirmSchema.parse({ first_name: ` ${first_name} ` }),
      ).toEqual({ first_name })
    },
  )
})
