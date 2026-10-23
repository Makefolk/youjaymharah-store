import { MedusaService } from "@medusajs/framework/utils";

import { PaymentCheck } from "./models/payment-check";

export default class PaymentReconciliationModuleService extends MedusaService({
  PaymentCheck,
}) {}
