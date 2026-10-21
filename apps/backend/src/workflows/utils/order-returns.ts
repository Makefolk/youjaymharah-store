import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, MathBN } from "@medusajs/framework/utils";

import {
  getReturnEligibility,
  type EligibilityOrder,
  type ReturnEligibility,
  type ReturnPolicy,
} from "../../lib/return-eligibility";
import { STOREFRONT_SETTINGS_MODULE } from "../../modules/storefront-settings";
import type StorefrontSettingsModuleService from "../../modules/storefront-settings/service";

export type ReturnContextOrder = EligibilityOrder & {
  id: string;
  email?: string | null;
  customer_id?: string | null;
  returns?:
    | ({
        id: string;
        status: string;
        created_at: Date | string;
        items?: ({ item_id: string; quantity: number } | null)[] | null;
      } | null)[]
    | null;
};

export type ReturnContext = {
  order: ReturnContextOrder;
  policy: ReturnPolicy;
  eligibility: ReturnEligibility;
};

export async function getReturnPolicy(
  container: MedusaContainer,
): Promise<ReturnPolicy> {
  const service: StorefrontSettingsModuleService = container.resolve(
    STOREFRONT_SETTINGS_MODULE,
  );
  const settings = await service.retrieveSettings();
  return {
    enabled: settings.returns_enabled,
    window_days: settings.return_window_days,
  };
}

/** An order with what deciding a return needs, or null when there is none. */
export async function loadReturnContext(
  container: MedusaContainer,
  orderId: string,
): Promise<ReturnContext | null> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const [
    {
      data: [order],
    },
    policy,
  ] = await Promise.all([
    query.graph({
      entity: "order",
      fields: [
        "id",
        "status",
        "canceled_at",
        "email",
        "customer_id",
        "items.id",
        "items.quantity",
        "items.detail.fulfilled_quantity",
        "items.detail.return_requested_quantity",
        "items.detail.return_received_quantity",
        "items.detail.return_dismissed_quantity",
        "items.detail.written_off_quantity",
        "fulfillments.canceled_at",
        "fulfillments.shipped_at",
        "fulfillments.delivered_at",
        // A full select, so BigNumber quantities are filled (see below).
        "fulfillments.items.*",
        "returns.id",
        "returns.status",
        "returns.created_at",
        // Selecting `quantity` alone leaves it empty: Medusa fills BigNumber
        // fields from their raw_ columns only on a full select.
        "returns.items.*",
      ],
      filters: { id: orderId },
    }),
    getReturnPolicy(container),
  ]);

  if (!order) return null;

  // Quantities can arrive as BigNumber objects, which Number() turns into NaN.
  const quantity = (value: unknown) =>
    value === null || value === undefined
      ? 0
      : MathBN.convert(
          value as Parameters<typeof MathBN.convert>[0],
        ).toNumber();
  const typed = {
    ...order,
    items: (order.items ?? []).map((item) =>
      item
        ? {
            ...item,
            quantity: quantity(item.quantity),
            detail: item.detail
              ? {
                  fulfilled_quantity: quantity(item.detail.fulfilled_quantity),
                  return_requested_quantity: quantity(
                    item.detail.return_requested_quantity,
                  ),
                  return_received_quantity: quantity(
                    item.detail.return_received_quantity,
                  ),
                  return_dismissed_quantity: quantity(
                    item.detail.return_dismissed_quantity,
                  ),
                  written_off_quantity: quantity(
                    item.detail.written_off_quantity,
                  ),
                }
              : null,
          }
        : null,
    ),
    returns: (order.returns ?? []).map((orderReturn) =>
      orderReturn
        ? {
            ...orderReturn,
            items: (orderReturn.items ?? []).map((line) =>
              line ? { ...line, quantity: quantity(line.quantity) } : null,
            ),
          }
        : null,
    ),
  } as unknown as ReturnContextOrder;
  return {
    order: typed,
    policy,
    eligibility: getReturnEligibility(typed, policy),
  };
}
