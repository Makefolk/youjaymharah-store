import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import type { AdminUpdateContentPagesType } from "../../middlewares";
import { STOREFRONT_SETTINGS_MODULE } from "../../../modules/storefront-settings";
import { completeContentPages } from "../../../modules/storefront-settings/content-pages";
import type StorefrontSettingsModuleService from "../../../modules/storefront-settings/service";
import { updateContentPagesWorkflow } from "../../../workflows/update-content-pages";

export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse,
) => {
  const service: StorefrontSettingsModuleService = req.scope.resolve(
    STOREFRONT_SETTINGS_MODULE,
  );
  const settings = await service.retrieveSettings();
  res.json({ pages: completeContentPages(settings.content_pages) });
};

export const POST = async (
  req: AuthenticatedMedusaRequest<AdminUpdateContentPagesType>,
  res: MedusaResponse,
) => {
  const { result } = await updateContentPagesWorkflow(req.scope).run({
    input: req.validatedBody,
  });
  res.json({ pages: result });
};
