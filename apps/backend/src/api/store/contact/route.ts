import type {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import { CONTACT_TOPIC_KINDS } from "../../../lib/support";
import { SUPPORT_MODULE } from "../../../modules/support";
import type SupportModuleService from "../../../modules/support/service";
import type { StoreContactMessageType } from "../../middlewares";
import { createSupportRequestWorkflow } from "../../../workflows/support";

/**
 * The website's contact form: becomes a support request. Only its reference
 * is returned; the link to follow it is emailed, so typing someone else's
 * address never shows you our replies to them.
 */
export const POST = async (
  req: AuthenticatedMedusaRequest<StoreContactMessageType>,
  res: MedusaResponse,
) => {
  const { website, topic, order_number, ...message } = req.validatedBody;

  // A field people can't see: only a bot fills it in. Answer as if sent, so
  // it has no reason to try something else.
  if (website) {
    res.json({ sent: true, reference: null });
    return;
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const email = message.email.trim().toLowerCase();

  // Tells staff whether the order number is really this sender's, so they
  // don't discuss someone else's order with whoever typed it.
  let order: { id: string; display_id: number } | null = null;
  let orderMatched: boolean | null = null;
  if (order_number) {
    const { data: orders } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", "email"],
      filters: { display_id: order_number },
    });
    const match = orders.find(
      (candidate) => candidate.email?.trim().toLowerCase() === email,
    );
    orderMatched = Boolean(match);
    order = match
      ? { id: match.id, display_id: Number(match.display_id) }
      : null;
  }

  // Signed in with the same address: it shows in their account too.
  let customerId: string | null = null;
  if (req.auth_context?.actor_id) {
    const {
      data: [customer],
    } = await query.graph({
      entity: "customer",
      fields: ["id", "email"],
      filters: { id: req.auth_context.actor_id },
    });
    if (customer?.email?.trim().toLowerCase() === email)
      customerId = customer.id;
  }

  const { result } = await createSupportRequestWorkflow(req.scope).run({
    input: {
      kind: (topic && CONTACT_TOPIC_KINDS[topic]) || "question",
      name: message.name,
      email,
      customer_id: customerId,
      order_id: order?.id ?? null,
      order_display_id:
        order?.display_id ?? (order_number ? Number(order_number) : null),
      order_matched: orderMatched,
      body: message.message,
    },
  });

  const created = await req.scope
    .resolve<SupportModuleService>(SUPPORT_MODULE)
    .retrieveSupportRequest(result.request_id, { select: ["reference"] });
  res.json({ sent: true, reference: created.reference });
};
