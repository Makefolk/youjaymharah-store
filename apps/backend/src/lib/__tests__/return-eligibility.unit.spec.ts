import {
  findIneligibleRequest,
  getReturnEligibility,
  type EligibilityOrder,
} from "../return-eligibility";

const policy = { enabled: true, window_days: 7 };
const now = new Date("2026-10-21T12:00:00.000Z");
const daysAgo = (days: number) =>
  new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

function order(overrides: Partial<EligibilityOrder> = {}): EligibilityOrder {
  return {
    status: "completed",
    items: [
      { id: "item_dress", quantity: 2, detail: { fulfilled_quantity: 2 } },
      { id: "item_bag", quantity: 1, detail: { fulfilled_quantity: 1 } },
    ],
    fulfillments: [
      {
        shipped_at: daysAgo(5),
        delivered_at: daysAgo(3),
        items: [{ line_item_id: "item_dress" }, { line_item_id: "item_bag" }],
      },
    ],
    ...overrides,
  };
}

describe("getReturnEligibility", () => {
  it("counts the window from delivery", () => {
    const result = getReturnEligibility(order(), policy, now);
    expect(result).toMatchObject({ open: true, reason: null });
    expect(result.items[0]).toEqual({
      item_id: "item_dress",
      returnable_quantity: 2,
      return_by: new Date(
        new Date(daysAgo(3)).getTime() + 7 * 24 * 60 * 60 * 1000,
      ).toISOString(),
    });
  });

  it("falls back to dispatch when delivery wasn't recorded", () => {
    const result = getReturnEligibility(
      order({
        fulfillments: [
          {
            shipped_at: daysAgo(8),
            items: [{ line_item_id: "item_dress" }],
          },
        ],
      }),
      policy,
      now,
    );
    expect(result.reason).toBe("expired");
  });

  it("subtracts quantities already being returned", () => {
    const result = getReturnEligibility(
      order({
        items: [
          {
            id: "item_dress",
            quantity: 2,
            detail: { fulfilled_quantity: 2, return_requested_quantity: 1 },
          },
          {
            id: "item_bag",
            quantity: 1,
            detail: { fulfilled_quantity: 1, return_received_quantity: 1 },
          },
        ],
      }),
      policy,
      now,
    );
    expect(result.items.map((item) => item.returnable_quantity)).toEqual([
      1, 0,
    ]);
  });

  it("explains why nothing can be returned", () => {
    expect(
      getReturnEligibility(order(), { ...policy, enabled: false }, now).reason,
    ).toBe("disabled");
    expect(
      getReturnEligibility(order({ status: "canceled" }), policy, now).reason,
    ).toBe("canceled");
    expect(
      getReturnEligibility(order({ fulfillments: [] }), policy, now).reason,
    ).toBe("not_shipped");
    expect(
      getReturnEligibility(
        order({
          fulfillments: [
            {
              delivered_at: daysAgo(2),
              canceled_at: daysAgo(1),
              items: [{ line_item_id: "item_dress" }],
            },
          ],
        }),
        policy,
        now,
      ).reason,
    ).toBe("not_shipped");
  });
});

describe("findIneligibleRequest", () => {
  const eligibility = getReturnEligibility(order(), policy, now);

  it("accepts quantities within what can be returned", () => {
    expect(
      findIneligibleRequest(eligibility, [{ id: "item_dress", quantity: 2 }]),
    ).toBeNull();
  });

  it("rejects too many, unknown or repeated items", () => {
    expect(
      findIneligibleRequest(eligibility, [{ id: "item_dress", quantity: 3 }]),
    ).toMatch("Only 2");
    expect(
      findIneligibleRequest(eligibility, [{ id: "item_other", quantity: 1 }]),
    ).toMatch("no longer");
    expect(
      findIneligibleRequest(eligibility, [
        { id: "item_bag", quantity: 1 },
        { id: "item_bag", quantity: 1 },
      ]),
    ).toMatch("once");
    expect(findIneligibleRequest(eligibility, [])).toMatch("at least one");
  });
});
