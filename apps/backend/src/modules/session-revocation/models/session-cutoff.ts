import { model } from "@medusajs/framework/utils";

/**
 * Sign-ins an actor (a customer or admin user) made before `signed_out_at`
 * no longer count: tokens and admin sessions issued earlier are refused.
 */
export const SessionCutoff = model
  .define("session_cutoff", {
    id: model.id({ prefix: "sescut" }).primaryKey(),
    actor_type: model.text(),
    actor_id: model.text(),
    signed_out_at: model.dateTime(),
  })
  .indexes([{ on: ["actor_type", "actor_id"], unique: true }]);
