import { model } from "@medusajs/framework/utils";

export const RefundRecord = model
  .define("refund_record", {
    id: model.id().primaryKey(),
    provider: model.text(),
    reference: model.text(),
    transaction_reference: model.text(),
    refund_id: model.text(),
    amount_in_minor: model.number(),
    currency_code: model.text(),
  })
  .indexes([{ on: ["provider", "reference"], unique: true }]);
