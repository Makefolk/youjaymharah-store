import { describe, expect, it } from "vitest"

import { hasRevalidateSecret, isRevalidatableTag } from "./revalidate"

describe("revalidation requests", () => {
  it("accept only the storefront's own cache tags", () => {
    for (const tag of ["storefront-settings", "products", "product:red-bag"]) {
      expect(isRevalidatableTag(tag)).toBe(true)
    }
    for (const tag of ["", "product:", "product:../x", "anything", 42]) {
      expect(isRevalidatableTag(tag)).toBe(false)
    }
  })

  it("need the configured secret", () => {
    expect(hasRevalidateSecret("s3cret", "s3cret")).toBe(true)
    expect(hasRevalidateSecret("wrong!", "s3cret")).toBe(false)
    expect(hasRevalidateSecret(null, "s3cret")).toBe(false)
    expect(hasRevalidateSecret("anything", undefined)).toBe(false)
    expect(hasRevalidateSecret("", "")).toBe(false)
  })
})
