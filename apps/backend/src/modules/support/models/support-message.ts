import { model } from "@medusajs/framework/utils";

import { SupportRequest } from "./support-request";

export const SupportMessage = model
  .define("support_message", {
    id: model.id({ prefix: "smsg" }).primaryKey(),
    author: model.enum(["customer", "staff"]),
    /** The admin user, for staff messages. */
    author_id: model.text().nullable(),
    author_name: model.text().nullable(),
    body: model.text(),
    /** A staff note the customer never sees. */
    internal: model.boolean().default(false),
    /**
     * Photos: { files: [{ key, name, type }] } in the private support bucket
     * (lib/support-files.ts), or { url, name } stored publicly in development.
     */
    attachments: model.json().nullable(),
    request: model.belongsTo(() => SupportRequest, { mappedBy: "messages" }),
  })
  .indexes([{ on: ["request_id", "created_at"], where: "deleted_at IS NULL" }]);
