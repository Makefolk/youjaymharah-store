import {
  createReturnAccessToken,
  isValidReturnAccessToken,
  RETURN_ACCESS_TTL_MS,
} from "../return-access";

describe("return access tokens", () => {
  const now = Date.UTC(2026, 9, 21);
  const token = createReturnAccessToken("order_1", "Ada@Example.com", now);

  it("works for its order and email, ignoring case, until it expires", () => {
    expect(
      isValidReturnAccessToken(token, "order_1", "ada@example.com", now),
    ).toBe(true);
    expect(
      isValidReturnAccessToken(
        token,
        "order_1",
        "ada@example.com",
        now + RETURN_ACCESS_TTL_MS + 1,
      ),
    ).toBe(false);
  });

  it("is refused for another order, a changed email or a tampered expiry", () => {
    expect(
      isValidReturnAccessToken(token, "order_2", "ada@example.com", now),
    ).toBe(false);
    expect(
      isValidReturnAccessToken(token, "order_1", "eve@example.com", now),
    ).toBe(false);
    const [, signature] = token.split(".");
    expect(
      isValidReturnAccessToken(
        `${now + 10 * RETURN_ACCESS_TTL_MS}.${signature}`,
        "order_1",
        "ada@example.com",
        now,
      ),
    ).toBe(false);
    expect(isValidReturnAccessToken("", "order_1", "ada@example.com")).toBe(
      false,
    );
    expect(isValidReturnAccessToken("garbage", "order_1", "a@b.c")).toBe(false);
  });
});
