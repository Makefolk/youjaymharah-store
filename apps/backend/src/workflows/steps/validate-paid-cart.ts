import { MedusaError } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { toMinorUnit } from "../../modules/payments/shared/amount";
import {
  checkWithGateway,
  getPaymentVerdict,
} from "../../modules/payments/lookup";
import { loadPaymentAttempt } from "../utils/payment-lookup";

/**
 * Only a cart the gateway confirms was paid, in full and for this amount,
 * and that has no order yet, may be turned into an order by staff. The
 * gateway is asked again here rather than trusting the lookup screen, which
 * may be minutes old.
 */
export const validatePaidCartStep = createStep(
  "validate-paid-cart",
  async (input: { session_id: string }, { container }) => {
    const loaded = await loadPaymentAttempt(container, input.session_id);
    if (!loaded) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Payment not found.");
    }
    const { attempt, data } = loaded;
    if (!attempt.cart) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This payment isn't attached to a cart, so there is nothing to turn into an order.",
      );
    }
    const gateway = await checkWithGateway(attempt.provider_id, data);
    const verdict = getPaymentVerdict({
      hasOrder: Boolean(attempt.order),
      gateway,
      expectedMinor: toMinorUnit(attempt.amount, attempt.currency_code),
      expectedCurrency: attempt.currency_code,
    });
    if (verdict !== "paid_no_order") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        {
          order_placed: "This payment already has an order.",
          amount_mismatch:
            "The amount paid doesn't match the cart, so no order can be made from it. Refund it from the gateway's dashboard.",
          not_paid: "The gateway doesn't show a successful payment.",
          unknown:
            "The gateway couldn't confirm the payment. Try again shortly.",
        }[verdict],
      );
    }
    return new StepResponse({ cart_id: attempt.cart.id });
  },
);
