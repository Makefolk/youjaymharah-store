import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { STOREFRONT_SETTINGS_MODULE } from "../../modules/storefront-settings";
import type StorefrontSettingsModuleService from "../../modules/storefront-settings/service";
import { STOREFRONT_SETTINGS_ID } from "../../modules/storefront-settings/service";

export type UpdateReturnPolicyInput = {
  enabled?: boolean;
  window_days?: number;
};

export type ReturnPolicy = { enabled: boolean; window_days: number };

export const updateReturnPolicyStep = createStep(
  "update-return-policy",
  async (input: UpdateReturnPolicyInput, { container }) => {
    const service: StorefrontSettingsModuleService = container.resolve(
      STOREFRONT_SETTINGS_MODULE,
    );

    // Reads through retrieveSettings so the row exists before the first edit.
    const previous = await service.retrieveSettings();

    const [updated] = await service.updateStorefrontSettings([
      {
        id: STOREFRONT_SETTINGS_ID,
        ...(input.enabled !== undefined && { returns_enabled: input.enabled }),
        ...(input.window_days !== undefined && {
          return_window_days: input.window_days,
        }),
      },
    ]);

    return new StepResponse<ReturnPolicy, ReturnPolicy>(
      {
        enabled: updated.returns_enabled,
        window_days: updated.return_window_days,
      },
      {
        enabled: previous.returns_enabled,
        window_days: previous.return_window_days,
      },
    );
  },
  async (previous, { container }) => {
    if (!previous) {
      return;
    }

    const service: StorefrontSettingsModuleService = container.resolve(
      STOREFRONT_SETTINGS_MODULE,
    );

    await service.updateStorefrontSettings([
      {
        id: STOREFRONT_SETTINGS_ID,
        returns_enabled: previous.enabled,
        return_window_days: previous.window_days,
      },
    ]);
  },
);
