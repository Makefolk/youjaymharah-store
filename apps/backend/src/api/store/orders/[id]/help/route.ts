import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";

import type { StoreOrderHelpType } from "../../../../middlewares";
import { SUPPORT_MODULE } from "../../../../../modules/support";
import type SupportModuleService from "../../../../../modules/support/service";
import { createSupportRequestWorkflow } from "../../../../../workflows/support";

/**
 * "Get help with this order": cancel, change the address, exchange, report
 * a damaged or missing item, or ask. Replies always go to the order's own
 * email, and only the reference comes back here, so someone who merely has
 * the order's link can neither read our answers nor redirect them; the
 * real customer hears about it before anything changes.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<StoreOrderHelpType>,
  res: MedusaResponse,
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const {
    data: [order],
  } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "customer_id",
      "shipping_address.first_name",
      "customer.first_name",
    ],
    filters: { id: req.params.id },
  });
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found.");
  }
  if (!order.email) {
    throw new MedusaError(
      MedusaError.Types.NOT_ALLOWED,
      "This order has no email address to reply to. Use the contact page.",
    );
  }

  const { result } = await createSupportRequestWorkflow(req.scope).run({
    input: {
      kind: req.validatedBody.kind,
      name:
        order.shipping_address?.first_name ||
        order.customer?.first_name ||
        "Customer",
      email: order.email,
      customer_id: order.customer_id ?? null,
      order_id: order.id,
      order_display_id: Number(order.display_id),
      body: req.validatedBody.message,
      photos: req.validatedBody.photos,
    },
  });

  const created = await req.scope
    .resolve<SupportModuleService>(SUPPORT_MODULE)
    .retrieveSupportRequest(result.request_id, { select: ["reference"] });
  res.json({ reference: created.reference, sent_to: maskEmail(order.email) });
};

function maskEmail(email: string): string {
  const [name, domain] = email.split("@");
  return `${name.slice(0, 1)}•••@${domain}`;
}
