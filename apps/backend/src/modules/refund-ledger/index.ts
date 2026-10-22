import { Module } from "@medusajs/framework/utils";
import RefundLedgerModuleService from "./service";

export const REFUND_LEDGER_MODULE = "refundLedger";
export default Module(REFUND_LEDGER_MODULE, {
  service: RefundLedgerModuleService,
});
