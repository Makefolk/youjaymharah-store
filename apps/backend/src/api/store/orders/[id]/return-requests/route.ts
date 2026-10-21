import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import type { StoreRequestReturnType } from "../../../../middlewares";
import { requestCustomerReturnWorkflow } from "../../../../../workflows/request-customer-return";

/**
 * Requests a return. Signed in, the order must be the customer's own; as a
 * guest, `access` must be the token from the emailed return link.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<StoreRequestReturnType>,
  res: MedusaResponse,
) => {
  const { result } = await requestCustomerReturnWorkflow(req.scope).run({
    input: {
      order_id: req.params.id,
      items: req.validatedBody.items,
      note: req.validatedBody.note,
      access: req.validatedBody.access,
      customer_id: req.auth_context?.actor_id ?? null,
    },
  });

  res.json({ return: { id: result.return_id } });
};
