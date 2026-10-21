import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";

import { NEWSLETTER_MODULE } from "../../../modules/newsletter";
import {
  DEFAULT_NEWSLETTER_DESCRIPTION,
  DEFAULT_NEWSLETTER_HEADING,
} from "../../../modules/newsletter/copy";
import type NewsletterModuleService from "../../../modules/newsletter/service";

/**
 * What the storefront needs to render signup: whether it is on, its heading
 * and description (defaults filled in, so the storefront holds no copy), and
 * the consent wording to show beside the form. Signup records `consent_text` on
 * the subscriber as evidence of what they agreed to, so the form has to show
 * that exact text -- this is where it gets it.
 *
 * Deliberately a subset: the audience id and reply-to address stay admin-only.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const service: NewsletterModuleService = req.scope.resolve(NEWSLETTER_MODULE);
  const settings = await service.retrieveSettings();

  res.json({
    newsletter: {
      enabled: settings.enabled,
      double_opt_in: settings.double_opt_in,
      heading: settings.heading || DEFAULT_NEWSLETTER_HEADING,
      description: settings.description || DEFAULT_NEWSLETTER_DESCRIPTION,
      consent_text: settings.consent_text,
      // The checkbox at checkout, when the store shows one.
      checkout_opt_in: settings.enabled && settings.checkout_opt_in,
      checkout_label:
        settings.checkout_label || "Email me about new collections and offers",
    },
  });
};
