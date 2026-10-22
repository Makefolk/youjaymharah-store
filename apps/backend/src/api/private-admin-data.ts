import type {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaNextFunction,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

/** Email records contain reset, invitation and verification credentials. */
export async function restrictNotifications(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const allowed = new Set([
    "id",
    "to",
    "channel",
    "template",
    "data",
    "trigger_type",
    "resource_id",
    "resource_type",
    "receiver_id",
    "created_at",
    "updated_at",
  ]);
  const fields = req.queryConfig.fields.filter((field) => allowed.has(field));
  req.queryConfig.fields = fields.length ? fields : ["id"];
  if (req.params.id) {
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
    const {
      data: [notification],
    } = await query.graph({
      entity: "notification",
      fields: ["id"],
      filters: { id: req.params.id, channel: "feed" },
    });
    if (!notification) {
      res.status(404).json({ message: "Notification not found." });
      return;
    }
  } else {
    req.filterableFields = {
      $and: [req.filterableFields ?? {}, { channel: "feed" }],
    };
  }
  next();
}

/** Durable workflow inputs can contain the same credentials as email records. */
export async function requireWorkflowAdministrator(
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction,
) {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data: users } = await query.graph({
    entity: "user",
    fields: ["id", "rbac_roles.id"],
    filters: {
      id: (req as AuthenticatedMedusaRequest).auth_context?.actor_id ?? "",
    },
  });
  const user = users[0] as unknown as
    { rbac_roles?: { id: string }[] } | undefined;
  if (!user?.rbac_roles?.some((role) => role?.id === "role_super_admin")) {
    res.status(403).json({ message: "Administrator access is required." });
    return;
  }
  next();
}
