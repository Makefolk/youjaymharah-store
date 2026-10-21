import { getPaymentVerdict, parsePaymentReference } from "../lookup";

const ULID = "01M5ETSP96ME66ACCSC7068M31";

describe("parsePaymentReference", () => {
  it("maps gateway references and session ids to the session", () => {
    expect(parsePaymentReference(`payses${ULID}`)).toBe(`payses_${ULID}`);
    expect(parsePaymentReference(` payses_${ULID} `)).toBe(`payses_${ULID}`);
    expect(parsePaymentReference(`payses${ULID.toLowerCase()}lq3k9z`)).toBe(
      `payses_${ULID}`,
    );
  });

  it("rejects anything else", () => {
    expect(parsePaymentReference("T123456789")).toBeNull();
    expect(parsePaymentReference(`payses${ULID}-x`)).toBeNull();
    expect(parsePaymentReference("")).toBeNull();
  });
});

describe("getPaymentVerdict", () => {
  const paid = {
    checked: true as const,
    status: "successful" as const,
    amount_in_minor: 15600000,
    currency_code: "NGN",
  };
  const expected = { expectedMinor: 15600000, expectedCurrency: "ngn" };

  it("is settled once an order exists, whatever the gateway says", () => {
    expect(
      getPaymentVerdict({
        hasOrder: true,
        gateway: { checked: false, reason: "down" },
        ...expected,
      }),
    ).toBe("order_placed");
  });

  it("finds paid carts without an order", () => {
    expect(
      getPaymentVerdict({ hasOrder: false, gateway: paid, ...expected }),
    ).toBe("paid_no_order");
  });

  it("flags a payment for a different amount", () => {
    expect(
      getPaymentVerdict({
        hasOrder: false,
        gateway: { ...paid, amount_in_minor: 15000000 },
        ...expected,
      }),
    ).toBe("amount_mismatch");
  });

  it("keeps an unfinished payment apart from a failed one", () => {
    expect(
      getPaymentVerdict({
        hasOrder: false,
        gateway: { ...paid, status: "pending" },
        ...expected,
      }),
    ).toBe("pending");
    expect(
      getPaymentVerdict({
        hasOrder: false,
        gateway: { ...paid, status: "failed" },
        ...expected,
      }),
    ).toBe("not_paid");
  });

  it("separates unpaid from unknown", () => {
    expect(
      getPaymentVerdict({
        hasOrder: false,
        gateway: { ...paid, status: "canceled" },
        ...expected,
      }),
    ).toBe("not_paid");
    expect(
      getPaymentVerdict({
        hasOrder: false,
        gateway: { checked: false, reason: "down" },
        ...expected,
      }),
    ).toBe("unknown");
  });
});
