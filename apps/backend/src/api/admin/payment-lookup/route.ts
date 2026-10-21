import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";

import type { AdminPaymentLookupType } from "../../middlewares";
import {
  checkWithGateway,
  getPaymentVerdict,
  parsePaymentReference,
} from "../../../modules/payments/lookup";
import { toMinorUnit } from "../../../modules/payments/shared/amount";
import {
  listPaymentAttemptsByEmail,
  loadPaymentAttempt,
} from "../../../workflows/utils/payment-lookup";

/**
 * By `reference`: the payment it belongs to, what the gateway says about it
 * right now, and a verdict. By `email`: recent payment attempts with that
 * email, without asking the gateway, to find the reference.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest<unknown, AdminPaymentLookupType>,
  res: MedusaResponse,
) => {
  const { reference, email } = req.validatedQuery as AdminPaymentLookupType;

  if (email) {
    res.json({ attempts: await listPaymentAttemptsByEmail(req.scope, email) });
    return;
  }

  const sessionId = parsePaymentReference(reference!);
  const loaded = sessionId && (await loadPaymentAttempt(req.scope, sessionId));
  if (!loaded) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "No payment has that reference. Credo's own transaction numbers can't be searched; search by the customer's email instead.",
    );
  }

  const { attempt, data } = loaded;
  const gateway = await checkWithGateway(attempt.provider_id, data);

  res.json({
    attempt,
    gateway,
    verdict: getPaymentVerdict({
      hasOrder: Boolean(attempt.order),
      gateway,
      expectedMinor: toMinorUnit(attempt.amount, attempt.currency_code),
      expectedCurrency: attempt.currency_code,
    }),
  });
};
