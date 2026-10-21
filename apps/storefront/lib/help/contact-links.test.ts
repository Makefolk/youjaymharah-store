import { describe, expect, it } from "vitest"

import { formatPhone, whatsappUrl } from "./contact-links"

describe("contact links", () => {
  it("links WhatsApp with digits only", () => {
    expect(whatsappUrl("+2348012345678")).toBe("https://wa.me/2348012345678")
  })

  it("groups Nigerian numbers and leaves others as stored", () => {
    expect(formatPhone("+2348012345678")).toBe("+234 801 234 5678")
    expect(formatPhone("+447700900123")).toBe("+447700900123")
  })
})
