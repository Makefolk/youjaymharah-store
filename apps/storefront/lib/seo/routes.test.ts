import { describe, expect, it } from "vitest"

import {
  orderConfirmationPath,
  orderHelpPath,
  orderPath,
  orderReturnPath,
} from "./routes"

describe("order links", () => {
  it("carry the order link's key when there is one", () => {
    expect(orderPath("order_1", "123.a-b_c")).toBe(
      "/orders/order_1?key=123.a-b_c",
    )
    expect(orderReturnPath("order_1", "k")).toBe("/orders/order_1/return?key=k")
    expect(orderConfirmationPath("order_1", "k")).toBe(
      "/orders/order_1?placed=1&key=k",
    )
    expect(orderHelpPath("order_1", "k", "cancel")).toBe(
      "/orders/order_1/help?kind=cancel&key=k",
    )
  })

  it("are plain without one, for the signed-in customer", () => {
    expect(orderPath("order_1")).toBe("/orders/order_1")
    expect(orderReturnPath("order_1", null)).toBe("/orders/order_1/return")
    expect(orderConfirmationPath("order_1", null)).toBe(
      "/orders/order_1?placed=1",
    )
    expect(orderHelpPath("order_1")).toBe("/orders/order_1/help")
  })
})
