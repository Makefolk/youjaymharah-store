import { randomUUID } from "node:crypto";
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import type { StoreOrderLookupType } from "../../middlewares";
import { resendOrderConfirmationWorkflow } from "../../../workflows/resend-order-confirmation";

/**
 * "Find my order" for guests without their confirmation email: when the
 * order number and email match, the confirmation is sent again, with a
 * fresh link. Nothing is opened here, since an order number and an email
 * are easy to learn; reading the inbox is the proof. The answer is the same
 * either way, so this can't reveal whether an email has ordered here.
 */
export const POST = async (
  req: MedusaRequest<StoreOrderLookupType>,
  res: MedusaResponse,
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { email, display_id } = req.validatedBody;

  const { data: orders } = await query.graph({
    entity: "order",
    fields: ["id", "email"],
    // Typed as text in the generated filters; the column is an integer.
    filters: { display_id: String(display_id) },
  });

  const order = orders.find(
    (candidate) =>
      candidate.email?.trim().toLowerCase() === email.trim().toLowerCase(),
  );

  if (order) {
    await resendOrderConfirmationWorkflow(req.scope).run({
      input: { id: order.id, resend_key: `lookup-${randomUUID()}` },
    });
  }

  res.json({ sent: true });
};
