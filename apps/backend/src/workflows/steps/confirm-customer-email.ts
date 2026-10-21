import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

export type ConfirmCustomerEmailInput = { token: string };

export type ConfirmCustomerEmailOutput = {
  customer_id: string;
  email: string;
};

/**
 * Spends a verification token and returns the customer it proves owns their
 * address. The token only counts for the account's current email: one sent
 * to an address the account has since moved away from proves nothing about
 * the new one.
 *
 * Nothing to compensate: a spent token stays spent, which is the point.
 */
export const confirmCustomerEmailStep = createStep(
  "confirm-customer-email",
  async (input: ConfirmCustomerEmailInput, { container }) => {
    const authService = container.resolve(Modules.AUTH);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const verification = await authService.confirmAuthVerification({
      code: input.token,
      code_provider: "token",
    });

    if (verification.entity_type !== "email") {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This link doesn't verify an email address.",
      );
    }

    const identity = await authService.retrieveAuthIdentity(
      verification.auth_identity_id,
    );
    const customerId = identity.app_metadata?.customer_id;
    const {
      data: [customer],
    } = customerId
      ? await query.graph({
          entity: "customer",
          fields: ["id", "email", "has_account"],
          filters: { id: customerId as string },
        })
      : { data: [] };

    const email = verification.entity_id.trim().toLowerCase();
    if (
      !customer?.has_account ||
      customer.email?.trim().toLowerCase() !== email
    ) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This link was for a different email address. Sign in and send a new one from your account.",
      );
    }

    return new StepResponse<ConfirmCustomerEmailOutput>({
      customer_id: customer.id,
      email,
    });
  },
);
