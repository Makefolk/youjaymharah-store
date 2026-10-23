import { Module } from "@medusajs/framework/utils";

import PaymentReconciliationModuleService from "./service";

export const PAYMENT_RECONCILIATION_MODULE = "paymentReconciliation";

export default Module(PAYMENT_RECONCILIATION_MODULE, {
  service: PaymentReconciliationModuleService,
});
