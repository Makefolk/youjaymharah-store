import {
  createOrderAccessKey,
  isValidOrderAccessKey,
  ORDER_ACCESS_TTL_MS,
} from "../order-access";

describe("order access keys", () => {
  const now = Date.UTC(2026, 9, 23);
  const key = createOrderAccessKey("order_1", now);

  it("opens its order until it expires", () => {
    expect(isValidOrderAccessKey(key, "order_1", now)).toBe(true);
    expect(
      isValidOrderAccessKey(key, "order_1", now + ORDER_ACCESS_TTL_MS - 1),
    ).toBe(true);
    expect(
      isValidOrderAccessKey(key, "order_1", now + ORDER_ACCESS_TTL_MS + 1),
    ).toBe(false);
  });

  it("is refused for another order, a tampered expiry or a missing key", () => {
    expect(isValidOrderAccessKey(key, "order_2", now)).toBe(false);
    const [, signature] = key.split(".");
    expect(
      isValidOrderAccessKey(
        `${now + 10 * ORDER_ACCESS_TTL_MS}.${signature}`,
        "order_1",
        now,
      ),
    ).toBe(false);
    expect(isValidOrderAccessKey(undefined, "order_1", now)).toBe(false);
    expect(isValidOrderAccessKey("garbage", "order_1", now)).toBe(false);
  });
});
