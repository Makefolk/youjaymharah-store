import { MedusaError, Modules } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { actorsOf } from "./sign-out-everywhere";

export type ChangeCustomerPasswordInput = {
  auth_identity_id: string;
  current_password: string;
  new_password: string;
};

/**
 * A signed-in customer changing their password: the current one is checked
 * first, so a borrowed, still-signed-in browser can't lock the owner out.
 * Accounts that only sign in with Google have no password to change; they
 * set one with POST /store/customers/me/password.
 *
 * Nothing to compensate: it is the workflow's only step, and the old hash
 * isn't readable to restore.
 */
export const changeCustomerPasswordStep = createStep(
  "change-customer-password",
  async (input: ChangeCustomerPasswordInput, { container }) => {
    const auth = container.resolve(Modules.AUTH);
    const identity = await auth.retrieveAuthIdentity(input.auth_identity_id, {
      relations: ["provider_identities"],
    });
    const login = (identity.provider_identities ?? []).find(
      (provider) => provider.provider === "emailpass",
    );
    if (!login) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This account signs in with Google, so it has no password yet. Set one instead.",
      );
    }

    const check = await auth.authenticate("emailpass", {
      body: { email: login.entity_id, password: input.current_password },
    });
    if (!check.success || check.authIdentity?.id !== identity.id) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Your current password isn't right.",
      );
    }

    const update = await auth.updateProvider("emailpass", {
      entity_id: login.entity_id,
      password: input.new_password,
    });
    if (!update.success) {
      throw new MedusaError(
        MedusaError.Types.UNEXPECTED_STATE,
        update.error ?? "Couldn't change the password.",
      );
    }

    return new StepResponse({ actors: actorsOf(identity.app_metadata) });
  },
);
