import { model } from "@medusajs/framework/utils";

/**
 * One gateway payment attempt (a payment session) being watched until it
 * either became an order or clearly didn't take money. Every attempt is
 * tracked, not only a bag's newest, so an older paid attempt can't hide
 * behind a newer abandoned one.
 */
export const PaymentCheck = model
  .define("payment_check", {
    id: model.id({ prefix: "paychk" }).primaryKey(),
    session_id: model.text().unique(),
    provider_id: model.text(),
    reference: model.text(),
    cart_id: model.text().nullable(),
    email: model.text().nullable(),
    amount: model.bigNumber(),
    currency_code: model.text(),
    session_created_at: model.dateTime(),
    /**
     * checking: rechecked on its schedule. needs_staff: paid without an
     * order, paid the wrong amount, or unfinished for a week. resolved: done.
     */
    status: model
      .enum(["checking", "needs_staff", "resolved"])
      .default("checking"),
    /** What the last check found (getPaymentVerdict, or order_placed). */
    verdict: model.text().nullable(),
    attempts: model.number().default(0),
    next_check_at: model.dateTime().nullable(),
    last_checked_at: model.dateTime().nullable(),
    /** order_placed, not_paid, or handled (by staff, with a note). */
    resolution: model.text().nullable(),
    resolved_at: model.dateTime().nullable(),
    /** The admin user who marked it handled. */
    resolved_by: model.text().nullable(),
    note: model.text().nullable(),
  })
  .indexes([
    { on: ["status", "next_check_at"], where: "deleted_at IS NULL" },
    { on: ["session_created_at"], where: "deleted_at IS NULL" },
  ]);
