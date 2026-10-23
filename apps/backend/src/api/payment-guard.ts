import type {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

/**
 * Medusa's built-in provider. It "authorizes" without taking any money,
 * which is what local testing needs and what a live store must never offer.
 */
export const TEST_PAYMENT_PROVIDER = "pp_system_default";

/**
 * Refuses the test provider for shoppers in production. The storefront only
 * hides it there, and a region can still list it (the seed once linked it),
 * so a direct Store API call could otherwise place an unpaid order.
 */
export function refuseTestPaymentsInProduction(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const providerId = (req.body as { provider_id?: unknown } | undefined)
    ?.provider_id;
  if (
    process.env.NODE_ENV === "production" &&
    providerId === TEST_PAYMENT_PROVIDER
  ) {
    res.status(400).json({
      type: "invalid_data",
      message: "This payment method isn't available.",
    });
    return;
  }
  next();
}
