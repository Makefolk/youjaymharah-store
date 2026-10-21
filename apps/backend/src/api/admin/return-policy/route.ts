import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import type { AdminUpdateReturnPolicyType } from "../../middlewares";
import { STOREFRONT_SETTINGS_MODULE } from "../../../modules/storefront-settings";
import type StorefrontSettingsModuleService from "../../../modules/storefront-settings/service";
import { updateReturnPolicyWorkflow } from "../../../workflows/update-return-policy";

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  const service: StorefrontSettingsModuleService = req.scope.resolve(
    STOREFRONT_SETTINGS_MODULE,
  );
  const settings = await service.retrieveSettings();

  res.json({
    return_policy: {
      enabled: settings.returns_enabled,
      window_days: settings.return_window_days,
    },
  });
};

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminUpdateReturnPolicyType>,
  res: MedusaResponse,
) => {
  const { result } = await updateReturnPolicyWorkflow(req.scope).run({
    input: req.validatedBody,
  });

  res.json({ return_policy: result });
};
