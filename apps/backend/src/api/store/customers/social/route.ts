import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";

import type { StoreCreateSocialCustomerType } from "../../../middlewares";
import { linkOrCreateCustomerAccountWorkflow } from "../../../../workflows/link-or-create-customer-account";

/**
 * Completes a social sign-in: call this with the token returned by
 * GET /auth/customer/{provider}/callback instead of POST /store/customers.
 *
 * When the verified email already belongs to an account, that account is
 * returned and the sign-in method is attached to it; otherwise a new customer
 * is created. Either way the caller ends up with one customer for the token.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<StoreCreateSocialCustomerType>,
  res: MedusaResponse,
) => {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  // Signing in again with an already-linked identity: nothing to do.
  const alreadyLinkedId = req.auth_context.actor_id;

  let customerId = alreadyLinkedId;
  let linked = !!alreadyLinkedId;

  if (!customerId) {
    const { result, errors } = await linkOrCreateCustomerAccountWorkflow(
      req.scope,
    ).run({
      input: {
        auth_identity_id: req.auth_context.auth_identity_id,
        first_name: req.validatedBody?.first_name ?? null,
        last_name: req.validatedBody?.last_name ?? null,
      },
    });

    if (errors?.length) throw errors[0].error;
    if (!result?.customer_id)
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        "Sign-in could not complete. Please try again.",
      );

    customerId = result.customer_id;
    linked = result.linked;
  }

  const {
    data: [customer],
  } = await query.graph({
    entity: "customer",
    fields: req.queryConfig?.fields ?? [
      "id",
      "email",
      "first_name",
      "last_name",
      "phone",
      "has_account",
      "created_at",
    ],
    filters: { id: customerId },
  });

  // `linked` tells the storefront whether this signed into an existing
  // account or created one, so it can word the welcome message accordingly.
  res.json({ customer, linked });
};
