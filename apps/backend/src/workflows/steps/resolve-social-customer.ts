import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

/**
 * Providers we trust to prove ownership of an email address, and may
 * therefore link to an existing customer account.
 *
 * Google qualifies because its provider refuses to create an auth identity
 * unless Google's id_token says `email_verified`. `emailpass` deliberately
 * does NOT: anyone can register a password identity claiming any address, so
 * linking on it would hand over the matching account.
 */
const TRUSTED_PROVIDERS = new Set(["google"]);

export type ResolveSocialCustomerInput = { auth_identity_id: string };

export type ResolveSocialCustomerOutput = {
  email: string;
  provider: string;
  /** The account this sign-in should attach to, when one already exists. */
  existing_customer_id: string | null;
};

export const resolveSocialCustomerStep = createStep(
  "resolve-social-customer",
  async (input: ResolveSocialCustomerInput, { container }) => {
    const authService = container.resolve(Modules.AUTH);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);

    const identity = await authService.retrieveAuthIdentity(
      input.auth_identity_id,
      { relations: ["provider_identities"] },
    );

    const providerIdentity = (identity.provider_identities ?? []).find((p) =>
      TRUSTED_PROVIDERS.has(p.provider),
    );

    if (!providerIdentity) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "This sign-in method cannot be linked to an existing account.",
      );
    }

    const email = (
      providerIdentity.user_metadata as { email?: string } | null
    )?.email
      ?.trim()
      .toLowerCase();

    if (!email) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `The ${providerIdentity.provider} sign-in did not return an email address.`,
      );
    }

    // Already linked (e.g. the customer signed in again): nothing to decide.
    const linkedCustomerId = (
      identity.app_metadata as { customer_id?: string } | null
    )?.customer_id;

    if (linkedCustomerId) {
      return new StepResponse<ResolveSocialCustomerOutput>({
        email,
        provider: providerIdentity.provider,
        existing_customer_id: linkedCustomerId,
      });
    }

    // Only registered accounts are linked. A guest customer with the same
    // address is left alone: it carries past orders but no login, and
    // createCustomerAccountWorkflow knows how to adopt it.
    const { data: customers } = await query.graph({
      entity: "customer",
      fields: ["id"],
      filters: { email, has_account: true },
    });

    const customerId = customers[0]?.id;
    if (customerId) {
      const identities = await authService.listAuthIdentities(
        { provider_identities: { provider: "emailpass", entity_id: email } },
        { relations: ["provider_identities"] },
      );
      const owners = identities.filter(
        (existing) => existing.app_metadata?.customer_id === customerId,
      );
      const message =
        "Verify your existing password account before linking Google. If you did not create it, reset its password first.";
      if (!owners.length) {
        throw new MedusaError(MedusaError.Types.NOT_ALLOWED, message);
      }
      for (const existing of owners) {
        const verifications = await authService.listAuthVerifications({
          auth_identity_id: existing.id,
          entity_type: "email",
          entity_id: email,
        });
        if (!verifications.some((verification) => verification.verified_at)) {
          throw new MedusaError(MedusaError.Types.NOT_ALLOWED, message);
        }
      }
    }

    return new StepResponse<ResolveSocialCustomerOutput>({
      email,
      provider: providerIdentity.provider,
      existing_customer_id: customerId ?? null,
    });
  },
);
