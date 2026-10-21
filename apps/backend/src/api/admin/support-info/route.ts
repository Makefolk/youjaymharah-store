import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import type { AdminUpdateSupportInfoType } from "../../middlewares";
import { STOREFRONT_SETTINGS_MODULE } from "../../../modules/storefront-settings";
import type StorefrontSettingsModuleService from "../../../modules/storefront-settings/service";
import { completeSupportInfo } from "../../../modules/storefront-settings/support-info";
import { updateSupportInfoWorkflow } from "../../../workflows/update-support-info";

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  const service: StorefrontSettingsModuleService = req.scope.resolve(
    STOREFRONT_SETTINGS_MODULE,
  );
  const settings = await service.retrieveSettings();

  res.json({ support_info: completeSupportInfo(settings.support_info) });
};

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminUpdateSupportInfoType>,
  res: MedusaResponse,
) => {
  const { result } = await updateSupportInfoWorkflow(req.scope).run({
    input: req.validatedBody,
  });

  res.json({ support_info: result });
};
