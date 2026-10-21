import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { STOREFRONT_SETTINGS_MODULE } from "../../modules/storefront-settings";
import type StorefrontSettingsModuleService from "../../modules/storefront-settings/service";
import { STOREFRONT_SETTINGS_ID } from "../../modules/storefront-settings/service";
import {
  completeSupportInfo,
  type SupportInfo,
} from "../../modules/storefront-settings/support-info";

/** Fields left out keep their value; null clears one. */
export type UpdateSupportInfoInput = Partial<SupportInfo>;

export const updateSupportInfoStep = createStep(
  "update-support-info",
  async (input: UpdateSupportInfoInput, { container }) => {
    const service: StorefrontSettingsModuleService = container.resolve(
      STOREFRONT_SETTINGS_MODULE,
    );

    // Reads through retrieveSettings so the row exists before the first edit.
    const previous = completeSupportInfo(
      (await service.retrieveSettings()).support_info,
    );
    const next: SupportInfo = { ...previous, ...input };

    await service.updateStorefrontSettings([
      { id: STOREFRONT_SETTINGS_ID, support_info: next },
    ]);

    return new StepResponse<SupportInfo, SupportInfo>(next, previous);
  },
  async (previous, { container }) => {
    if (!previous) return;
    const service: StorefrontSettingsModuleService = container.resolve(
      STOREFRONT_SETTINGS_MODULE,
    );
    await service.updateStorefrontSettings([
      { id: STOREFRONT_SETTINGS_ID, support_info: previous },
    ]);
  },
);
