import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";

import type { AdminSupportRequestsQueryType } from "../../middlewares";
import { SUPPORT_MODULE } from "../../../modules/support";
import type SupportModuleService from "../../../modules/support/service";

/**
 * The inbox: requests with the most recent activity first, with how many
 * are in each status. `assigned_to=me` shows the caller's.
 */
export const GET = async (
  req: AuthenticatedMedusaRequest<unknown, AdminSupportRequestsQueryType>,
  res: MedusaResponse,
) => {
  const { status, assigned_to, q, offset, limit } = req.validatedQuery;
  const service: SupportModuleService = req.scope.resolve(SUPPORT_MODULE);
  const assignee =
    assigned_to === "me" ? req.auth_context.actor_id : assigned_to;
  const search = q?.trim();

  const filters = {
    ...(status ? { status } : {}),
    ...(assignee ? { assigned_to: assignee } : {}),
    ...(search
      ? {
          $or: [
            { reference: { $ilike: `%${search}%` } },
            { email: { $ilike: `%${search}%` } },
            { name: { $ilike: `%${search}%` } },
          ],
        }
      : {}),
  };

  const [[requests, count], counts] = await Promise.all([
    service.listAndCountSupportRequests(filters, {
      order: { last_message_at: "DESC" },
      skip: offset,
      take: limit,
    }),
    Promise.all(
      (["open", "awaiting_customer", "resolved"] as const).map(
        async (state) =>
          [
            state,
            (
              await service.listAndCountSupportRequests(
                { status: state },
                { take: 1, select: ["id"] },
              )
            )[1],
          ] as const,
      ),
    ),
  ]);

  res.json({
    requests,
    count,
    offset,
    limit,
    counts: Object.fromEntries(counts),
  });
};
