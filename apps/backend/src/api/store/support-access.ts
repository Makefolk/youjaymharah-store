import type { AuthenticatedMedusaRequest } from "@medusajs/framework/http";
import { MedusaError } from "@medusajs/framework/utils";

import { isValidSupportAccessToken } from "../../lib/support";
import { SUPPORT_MODULE } from "../../modules/support";
import type SupportModuleService from "../../modules/support/service";

/**
 * A request the caller may see: their own account's, or one whose emailed
 * link (`access`) they hold. Anything else reads as not found, so request
 * ids can't be probed.
 */
export async function loadAccessibleRequest(
  req: AuthenticatedMedusaRequest,
  access: string | null | undefined,
) {
  const service: SupportModuleService = req.scope.resolve(SUPPORT_MODULE);
  const [request] = await service.listSupportRequests(
    { id: req.params.id },
    { take: 1 },
  );
  const allowed =
    request &&
    ((req.auth_context?.actor_id &&
      request.customer_id === req.auth_context.actor_id) ||
      isValidSupportAccessToken(access, request.id, request.email));
  if (!request || !allowed) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Request not found.");
  }
  return request;
}

/** What a customer sees of their request: never staff notes or staff ids. */
export async function publicThread(
  req: AuthenticatedMedusaRequest,
  requestId: string,
) {
  const service: SupportModuleService = req.scope.resolve(SUPPORT_MODULE);
  const messages = await service.listSupportMessages(
    { request_id: requestId, internal: false },
    { order: { created_at: "ASC" } },
  );
  return messages.map((message) => ({
    id: message.id,
    author: message.author,
    // Staff are "the team" to customers; the name is their own choice.
    author_name: message.author === "customer" ? message.author_name : null,
    body: message.body,
    photos:
      (
        message.attachments as {
          files?: { url: string; name: string }[];
        } | null
      )?.files ?? [],
    created_at: new Date(message.created_at).toISOString(),
  }));
}

export function publicRequest(request: {
  id: string;
  reference: string;
  kind: string;
  status: string;
  order_id: string | null;
  order_display_id: number | null;
  created_at: Date | string;
  last_message_at: Date | string;
}) {
  return {
    id: request.id,
    reference: request.reference,
    kind: request.kind,
    status: request.status,
    order_id: request.order_id,
    order_display_id: request.order_display_id,
    created_at: new Date(request.created_at).toISOString(),
    last_message_at: new Date(request.last_message_at).toISOString(),
  };
}
