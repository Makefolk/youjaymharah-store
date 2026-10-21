import { describe, expect, it } from "vitest"

import {
  formatOrderNumber,
  getOrderProgress,
  getPaymentLabel,
  getShipments,
} from "./order"

describe("getOrderProgress", () => {
  it("follows the fulfilment status", () => {
    expect(
      getOrderProgress({
        status: "pending",
        fulfillment_status: "not_fulfilled",
      }),
    ).toEqual({ stage: "placed", label: "Order placed", partial: false })
    expect(
      getOrderProgress({
        status: "pending",
        fulfillment_status: "partially_shipped",
      }),
    ).toEqual({ stage: "shipped", label: "Partly shipped", partial: true })
    expect(
      getOrderProgress({ status: "completed", fulfillment_status: "delivered" })
        .stage,
    ).toBe("delivered")
  })

  it("puts cancellation above everything else", () => {
    expect(
      getOrderProgress({ status: "canceled", fulfillment_status: "shipped" })
        .stage,
    ).toBe("canceled")
  })
})

describe("getPaymentLabel", () => {
  it("treats held money as paid and unknown states as pending", () => {
    expect(getPaymentLabel("authorized")).toBe("Paid")
    expect(getPaymentLabel("awaiting")).toBe("Awaiting payment")
    expect(getPaymentLabel(undefined)).toBe("Payment pending")
  })
})

describe("getShipments", () => {
  it("lists shipped, uncanceled fulfilments oldest first with safe tracking links", () => {
    const shipments = getShipments([
      {
        id: "ful_2",
        shipped_at: "2026-10-12T10:00:00.000Z",
        labels: [
          { tracking_number: "GIG123", tracking_url: "javascript:alert(1)" },
        ],
        items: [{ line_item_id: "item_b" }],
      },
      { id: "ful_packed", items: [{ line_item_id: "item_c" }] },
      {
        id: "ful_canceled",
        shipped_at: "2026-10-09T10:00:00.000Z",
        canceled_at: "2026-10-09T11:00:00.000Z",
      },
      {
        id: "ful_1",
        shipped_at: "2026-10-10T10:00:00.000Z",
        delivered_at: "2026-10-11T10:00:00.000Z",
        labels: [
          { tracking_number: " ", tracking_url: "https://track.example/1" },
          { tracking_number: "", tracking_url: "" },
        ],
        items: [{ line_item_id: "item_a" }],
      },
    ])

    expect(shipments.map((shipment) => shipment.id)).toEqual(["ful_1", "ful_2"])
    expect(shipments[0].tracking).toEqual([
      { number: null, url: "https://track.example/1" },
    ])
    expect(shipments[1].tracking).toEqual([{ number: "GIG123", url: null }])
    expect(shipments[1].itemIds).toEqual(["item_b"])
  })
})

it("formats order numbers like the emails", () => {
  expect(formatOrderNumber(1042)).toBe("#1042")
  expect(formatOrderNumber(null)).toBe("")
})
