import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { STOREFRONT_SETTINGS_MODULE } from "../../modules/storefront-settings";
import {
  completeContentPages,
  type ContentPages,
} from "../../modules/storefront-settings/content-pages";
import type StorefrontSettingsModuleService from "../../modules/storefront-settings/service";
import { STOREFRONT_SETTINGS_ID } from "../../modules/storefront-settings/service";

/** Pages left out keep their text; null clears one. */
export type UpdateContentPagesInput = Partial<ContentPages>;

export const updateContentPagesStep = createStep(
  "update-content-pages",
  async (input: UpdateContentPagesInput, { container }) => {
    const service: StorefrontSettingsModuleService = container.resolve(
      STOREFRONT_SETTINGS_MODULE,
    );
    // Reads through retrieveSettings so the row exists before the first edit.
    const previous = completeContentPages(
      (await service.retrieveSettings()).content_pages,
    );
    const next: ContentPages = { ...previous, ...input };
    await service.updateStorefrontSettings([
      { id: STOREFRONT_SETTINGS_ID, content_pages: next },
    ]);
    return new StepResponse<ContentPages, ContentPages>(next, previous);
  },
  async (previous, { container }) => {
    if (!previous) return;
    const service: StorefrontSettingsModuleService = container.resolve(
      STOREFRONT_SETTINGS_MODULE,
    );
    await service.updateStorefrontSettings([
      { id: STOREFRONT_SETTINGS_ID, content_pages: previous },
    ]);
  },
);
