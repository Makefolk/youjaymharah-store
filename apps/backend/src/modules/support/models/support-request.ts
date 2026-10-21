import { model } from "@medusajs/framework/utils";

import { SupportMessage } from "./support-message";

/**
 * A customer's question or problem, from the contact page or an order's
 * "Get help" form, with its conversation. Staff work it from Support inbox
 * in the admin; the customer follows it from their account or the link in
 * their emails.
 */
export const SupportRequest = model
  .define("support_request", {
    id: model.id({ prefix: "sreq" }).primaryKey(),
    /** Short and readable, quoted to customers: "SR-7K3Q9P". */
    reference: model.text().unique(),
    kind: model.enum([
      "question",
      "order",
      "delivery",
      "return",
      "product",
      "cancel",
      "change_address",
      "exchange",
      "damaged",
      "missing",
    ]),
    /**
     * open: waiting on staff. awaiting_customer: staff replied and asked or
     * answered. resolved: done; a customer reply reopens it.
     */
    status: model
      .enum(["open", "awaiting_customer", "resolved"])
      .default("open"),
    priority: model.enum(["normal", "high"]).default("normal"),
    /** Where replies go. For an order request, always the order's email. */
    email: model.text(),
    name: model.text(),
    customer_id: model.text().nullable(),
    order_id: model.text().nullable(),
    order_display_id: model.number().nullable(),
    /** The admin user working it. */
    assigned_to: model.text().nullable(),
    last_message_at: model.dateTime(),
    messages: model.hasMany(() => SupportMessage, { mappedBy: "request" }),
  })
  .indexes([
    { on: ["status", "last_message_at"], where: "deleted_at IS NULL" },
    { on: ["customer_id"], where: "deleted_at IS NULL" },
    { on: ["email"], where: "deleted_at IS NULL" },
    { on: ["order_id"], where: "deleted_at IS NULL" },
  ]);
