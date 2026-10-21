import type { IPaymentModuleService } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { toMinorUnit } from "../../modules/payments/shared/amount";
import type { DashboardRefund } from "../../modules/payments/shared/types";

const CREDO_PROVIDER_ID = "pp_credo_credo";

export type AuthorizeDashboardRefundInput = {
  order_id: string;
  payment_id: string;
  amount: number;
  reference: string;
  user_id: string;
};

/**
 * Lets the Credo provider accept exactly this refund, which staff already
 * made in the Credo dashboard (it has no refund API). Only for a Credo
 * payment of this order; the provider removes the authorization as it
 * accepts the refund, and undoing the step removes it if the refund fails.
 */
export const authorizeDashboardRefundStep = createStep(
  "authorize-dashboard-refund",
  async (input: AuthorizeDashboardRefundInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const payments: IPaymentModuleService = container.resolve(Modules.PAYMENT);

    const {
      data: [order],
    } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "payment_collections.payments.id",
        "payment_collections.payments.provider_id",
        "payment_collections.payments.currency_code",
        "payment_collections.payments.data",
      ],
      filters: { id: input.order_id },
    });
    if (!order) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found.");
    }

    const payment = (order.payment_collections ?? [])
      .flatMap((collection) => collection?.payments ?? [])
      .find((entry) => entry?.id === input.payment_id);
    if (!payment) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "That payment isn't part of this order.",
      );
    }
    if (payment.provider_id !== CREDO_PROVIDER_ID) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Only Credo payments are refunded from a dashboard; use the payment's Refund button.",
      );
    }

    const previous = (payment.data ?? {}) as Record<string, unknown>;
    const authorization: DashboardRefund = {
      reference: input.reference,
      amount_in_minor: toMinorUnit(input.amount, payment.currency_code),
      recorded_by: input.user_id,
    };
    // UpdatePaymentDTO's type lists only `id`, but the module saves `data`
    // too; it is how providers keep their state.
    await payments.updatePayment({
      id: payment.id,
      data: { ...previous, dashboard_refund: authorization },
    } as Parameters<IPaymentModuleService["updatePayment"]>[0]);

    return new StepResponse(
      { payment_id: payment.id },
      { payment_id: payment.id, data: previous },
    );
  },
  async (previous, { container }) => {
    if (!previous) return;
    const payments: IPaymentModuleService = container.resolve(Modules.PAYMENT);
    // Null, not left out: stored data is merged, so a missing key stays.
    await payments.updatePayment({
      id: previous.payment_id,
      data: { ...previous.data, dashboard_refund: null },
    } as Parameters<IPaymentModuleService["updatePayment"]>[0]);
  },
);
