import type RefundLedgerModuleService from "../../refund-ledger/service";
import type { Logger } from "@medusajs/framework/types";
import PaystackPaymentProvider from "../paystack/service";
import CredoPaymentProvider from "../credo/service";
import { createHmac } from "node:crypto";

const session = {
  reference: "ref123",
  gateway_reference: "credo123",
  session_id: "payses_123",
  amount_in_minor: 1000000,
  currency_code: "NGN",
  redirect_url: "https://example.com/pay",
};
const logger = { error: jest.fn() } as unknown as Logger;
const refundLedger = {
  claim: jest.fn().mockResolvedValue(undefined),
} as unknown as RefundLedgerModuleService;
const paystack = () =>
  new PaystackPaymentProvider({ logger, refundLedger }, { secretKey: "test" });
const credo = () =>
  new CredoPaymentProvider(
    { logger, refundLedger },
    { secretKey: "test", publicKey: "test", mode: "test" },
  );
const originalFetch = global.fetch;
function gatewayResponse(data: Record<string, unknown>) {
  global.fetch = jest
    .fn()
    .mockImplementation(
      async () => new Response(JSON.stringify({ status: true, data })),
    );
}
afterEach(() => {
  global.fetch = originalFetch;
});

describe("verified payments", () => {
  const good = {
    status: "success",
    amount: 1000000,
    currency: "NGN",
    reference: "ref123",
  };
  it("accepts a matching server-verified payment", async () => {
    gatewayResponse(good);
    expect((await paystack().authorizePayment({ data: session })).status).toBe(
      "captured",
    );
  });
  it.each([
    { amount: 1 },
    { currency: "USD" },
    { reference: "another" },
    { amount: undefined },
    { currency: undefined },
    { reference: undefined },
    { amount: -1 },
    { amount: 1.5 },
  ])(
    "rejects mismatched or missing verification fields: %j",
    async (change) => {
      gatewayResponse({ ...good, ...change });
      await expect(
        paystack().authorizePayment({ data: session }),
      ).rejects.toThrow("does not match");
      await expect(
        paystack().capturePayment({ data: session }),
      ).rejects.toThrow("does not match");
    },
  );
  it("does not capture an unpaid transaction", async () => {
    gatewayResponse({ ...good, status: "pending" });
    await expect(paystack().capturePayment({ data: session })).rejects.toThrow(
      "Cannot capture",
    );
  });
  it("reads Credo's documented monetary and business reference fields", async () => {
    gatewayResponse({
      status: 0,
      transAmount: 1000000,
      currencyCode: "NGN",
      businessRef: "ref123",
      transRef: "credo123",
    });
    expect((await credo().authorizePayment({ data: session })).status).toBe(
      "captured",
    );
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("credo123/verify"),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });
  it("rejects a Credo transaction for another business reference", async () => {
    gatewayResponse({
      status: 0,
      transAmount: 1000000,
      currencyCode: "NGN",
      businessRef: "another",
    });
    await expect(credo().capturePayment({ data: session })).rejects.toThrow(
      "does not match",
    );
  });
  it.each([1, 2])(
    "does not authorize a refunded Credo transaction (status %s)",
    async (status) => {
      gatewayResponse({
        status,
        transAmount: 1000000,
        currencyCode: "NGN",
        businessRef: "ref123",
      });
      expect((await credo().authorizePayment({ data: session })).status).toBe(
        "canceled",
      );
    },
  );
  it("validates a Credo body signature and rejects tampered payloads", async () => {
    const data = {
      event: "transaction.successful",
      data: {
        status: 0,
        transAmount: 1000000,
        currencyCode: "NGN",
        metadata: {
          customFields: [
            { variable_name: "medusa_session_id", value: "payses_123" },
          ],
        },
      },
    };
    const rawData = JSON.stringify(data);
    const signature = createHmac("sha512", "test")
      .update(rawData)
      .digest("hex");
    const payload = {
      data,
      rawData,
      headers: { "credo-signature": signature },
    };
    expect((await credo().getWebhookActionAndData(payload)).action).toBe(
      "captured",
    );
    expect(
      (
        await credo().getWebhookActionAndData({
          ...payload,
          rawData: `${rawData} `,
        })
      ).action,
    ).toBe("failed");
  });
  it("reinitializes on a currency-only change", async () => {
    gatewayResponse({
      reference: "newref",
      authorization_url: "https://example.com/new",
    });
    const result = await paystack().updatePayment({
      data: { ...session, payer: { email: "buyer@example.com" } },
      amount: 10000,
      currency_code: "USD",
    });
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.data?.currency_code).toBe("USD");
  });

  it("accepts a signed Paystack event using the original bytes and major-unit amount", async () => {
    const data = {
      event: "charge.success",
      data: { ...good, metadata: { session_id: session.session_id } },
    };
    const rawData = JSON.stringify(data);
    const headers = {
      "x-paystack-signature": createHmac("sha512", "test")
        .update(rawData)
        .digest("hex"),
    };
    const result = await paystack().getWebhookActionAndData({
      data,
      rawData: Buffer.from(rawData),
      headers,
    });
    expect(result.action).toBe("captured");
    expect(result.data?.session_id).toBe(session.session_id);
    expect(Number(result.data?.amount)).toBe(10000);
    expect(
      (
        await paystack().getWebhookActionAndData({
          data,
          rawData: rawData + " ",
          headers,
        })
      ).action,
    ).toBe("failed");
  });

  it.each([{}, { "x-paystack-signature": "not-a-signature" }])(
    "rejects unsigned or malformed Paystack signatures: %j",
    async (headers) => {
      const data = {
        event: "charge.success",
        data: { ...good, metadata: { session_id: session.session_id } },
      };
      expect(
        (
          await paystack().getWebhookActionAndData({
            data,
            rawData: JSON.stringify(data),
            headers,
          })
        ).action,
      ).toBe("failed");
    },
  );
});

describe("Credo dashboard refunds", () => {
  it("refuses a refund nobody recorded from the dashboard", async () => {
    global.fetch = jest.fn();
    await expect(
      credo().refundPayment({ data: session, amount: 10000 }),
    ).rejects.toThrow(/Credo dashboard/);
    await expect(
      credo().refundPayment({
        data: {
          ...session,
          dashboard_refund: {
            reference: "CR-1",
            amount_in_minor: 500000,
            recorded_by: "user_1",
          },
        },
        amount: 10000,
      }),
    ).rejects.toThrow(/Credo dashboard/);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("records an authorized one without calling Credo, once", async () => {
    global.fetch = jest.fn();
    const { data } = await credo().refundPayment({
      context: { idempotency_key: "refund_test" },
      data: {
        ...session,
        dashboard_refund: {
          reference: "CR-1",
          amount_in_minor: 1000000,
          recorded_by: "user_1",
        },
      },
      amount: 10000,
    });
    expect(data!.dashboard_refund).toBeNull();
    expect(data!.refund).toMatchObject({
      source: "credo_dashboard",
      reference: "CR-1",
      recorded_by: "user_1",
    });
    expect(global.fetch).not.toHaveBeenCalled();
    // The authorization is spent: the stored data can't refund again.
    await expect(
      credo().refundPayment({ data: data!, amount: 10000 }),
    ).rejects.toThrow(/Credo dashboard/);
  });
});

describe("starting a payment", () => {
  it("logs the gateway's error and shows the shopper a plain message", async () => {
    global.fetch = jest.fn().mockImplementation(
      async () =>
        new Response(
          JSON.stringify({
            status: 401,
            message: "You may not have the necessary permissions",
          }),
          { status: 401 },
        ),
    );
    (logger.error as jest.Mock).mockClear();
    const error = await credo()
      .initiatePayment({
        amount: 100,
        currency_code: "NGN",
        data: { session_id: "payses_1", payer: { email: "a@b.co" } },
      })
      .catch((e: Error) => e);
    expect((error as Error).message).toBe(
      "We couldn't start this payment just now. Please try again, or choose another way to pay.",
    );
    expect((logger.error as jest.Mock).mock.calls[0][0]).toMatch(
      /payses_1.*Credo POST \/transaction\/initialize failed \(401\)/,
    );
  });
});
