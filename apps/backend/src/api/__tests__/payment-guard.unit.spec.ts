import {
  refuseTestPaymentsInProduction,
  TEST_PAYMENT_PROVIDER,
} from "../payment-guard";

describe("test payments in production", () => {
  const environment = process.env.NODE_ENV;
  afterEach(() => {
    process.env.NODE_ENV = environment;
  });

  function attempt(providerId: string) {
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;
    const next = jest.fn();
    refuseTestPaymentsInProduction(
      { body: { provider_id: providerId } } as any,
      res,
      next,
    );
    return { res, next };
  }

  it("are refused in production, while the gateways go through", () => {
    process.env.NODE_ENV = "production";
    const refused = attempt(TEST_PAYMENT_PROVIDER);
    expect(refused.next).not.toHaveBeenCalled();
    expect(refused.res.status).toHaveBeenCalledWith(400);
    expect(attempt("pp_paystack_paystack").next).toHaveBeenCalled();
  });

  it("are allowed elsewhere, for local testing", () => {
    process.env.NODE_ENV = "development";
    expect(attempt(TEST_PAYMENT_PROVIDER).next).toHaveBeenCalled();
  });
});
