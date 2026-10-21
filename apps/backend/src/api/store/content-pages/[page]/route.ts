import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";

import { STOREFRONT_SETTINGS_MODULE } from "../../../../modules/storefront-settings";
import {
  completeContentPages,
  CONTENT_PAGES,
  type ContentPage,
} from "../../../../modules/storefront-settings/content-pages";
import type StorefrontSettingsModuleService from "../../../../modules/storefront-settings/service";

/** One page's text, for the storefront's About and Privacy pages. */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const page = req.params.page as ContentPage;
  if (!CONTENT_PAGES.includes(page)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "No such page.");
  }
  const service: StorefrontSettingsModuleService = req.scope.resolve(
    STOREFRONT_SETTINGS_MODULE,
  );
  const text = completeContentPages(
    (await service.retrieveSettings()).content_pages,
  )[page];
  if (!text) {
    throw new MedusaError(
      MedusaError.Types.NOT_FOUND,
      "This page hasn't been written yet.",
    );
  }
  res.json({ page: { name: page, text } });
};
