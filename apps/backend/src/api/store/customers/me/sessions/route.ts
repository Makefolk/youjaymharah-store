import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import { signOutEverywhereWorkflow } from "../../../../../workflows/sign-out-everywhere";

/**
 * "Sign out of all devices": ends every sign-in to this account, the
 * caller's included. /store/customers/me/* already requires a customer.
 */
export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  await signOutEverywhereWorkflow(req.scope).run({
    input: {
      actors: [{ actor_type: "customer", actor_id: req.auth_context.actor_id }],
    },
  });
  res.json({ signed_out: true });
};
