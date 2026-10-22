import type { IPaymentModuleService } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { toMinorUnit } from "../../modules/payments/shared/amount";
import type { DashboardRefund } from "../../modules/payments/shared/types";
import { REFUND_LEDGER_MODULE } from "../../modules/refund-ledger";
import type RefundLedgerModuleService from "../../modules/refund-ledger/service";

export type AuthorizeDashboardRefundInput = {
  order_id: string;
  payment_id: string;
  amount: number;
  reference: string;
  user_id: string;
  provider?: "credo" | "paystack";
};

/**
 * Dashboard refunds need a one-use authorization on this order's payment.
 * The provider consumes it; compensation clears it if recording fails.
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
        "payment_collections.payments.refunds.id",
        "payment_collections.payments.refunds.note",
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
    const provider = input.provider ?? "credo";
    if (payment.provider_id !== `pp_${provider}_${provider}`) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        `This is not a ${provider} payment.`,
      );
    }

    const previous = (payment.data ?? {}) as Record<string, unknown>;
    const prefix =
      `Refunded in the ${provider} dashboard, reference ${input.reference.trim()}.`.toLowerCase();
    if (
      payment.refunds?.some((refund) =>
        refund?.note?.toLowerCase().startsWith(prefix),
      )
    ) {
      throw new MedusaError(
        MedusaError.Types.CONFLICT,
        "This gateway refund is already recorded.",
      );
    }
    if (provider === "paystack" && payment.refunds?.length) {
      const ledger: RefundLedgerModuleService =
        container.resolve(REFUND_LEDGER_MODULE);
      const recorded = await ledger.listRefundRecords({
        transaction_reference: String(previous.reference),
      });
      const known = new Set(recorded.map((entry) => entry.refund_id));
      if (payment.refunds.some((refund) => refund && !known.has(refund.id))) {
        throw new MedusaError(
          MedusaError.Types.CONFLICT,
          "Reconcile this payment's earlier Paystack refunds before recording another refund.",
        );
      }
    }
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
      data: { dashboard_refund: null },
    } as Parameters<IPaymentModuleService["updatePayment"]>[0]);
  },
);
