import type { MedusaContainer } from "@medusajs/framework/types";
import {
  ChangeActionType,
  ContainerRegistrationKeys,
} from "@medusajs/framework/utils";
import {
  acceptOrderTransferWorkflow,
  requestOrderTransferWorkflow,
} from "@medusajs/medusa/core-flows";

/**
 * Moves the orders placed as a guest with this email into the customer's
 * account, so they show in its order history and returns. Uses Medusa's order
 * transfer, which records the change on each order's timeline.
 *
 * Only call this once the customer has proved they own the email: anyone can
 * register an account with any address.
 *
 * Each order is transferred on its own, so one that can't be (canceled, or
 * mid-edit) doesn't stop the rest. Returns how many moved.
 */
export async function linkGuestOrders(
  container: MedusaContainer,
  { customer_id, email }: { customer_id: string; email: string },
): Promise<number> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);

  const { data: orders } = await query.graph({
    entity: "order",
    fields: [
      "id",
      "display_id",
      "email",
      "customer.id",
      "customer.has_account",
    ],
    filters: { email },
    pagination: { take: 500 },
  });

  const guestOrders = orders.filter(
    (order) =>
      order.email?.toLowerCase() === email &&
      !order.customer?.has_account &&
      order.customer?.id !== customer_id,
  );

  let linked = 0;
  for (const order of guestOrders) {
    try {
      await requestOrderTransferWorkflow(container).run({
        input: {
          order_id: order.id,
          customer_id,
          logged_in_user: customer_id,
          description:
            "Linked to the customer's account after they verified this email.",
        },
      });

      // The request stores its one-time token on the order change; accepting
      // with it is what moves the order.
      const {
        data: [change],
      } = await query.graph({
        entity: "order_change",
        fields: ["id", "actions.action", "actions.details"],
        filters: {
          order_id: order.id,
          change_type: "transfer",
          status: "requested",
        },
      });
      const token = (change?.actions ?? []).find(
        (action) =>
          String(action?.action) === ChangeActionType.TRANSFER_CUSTOMER,
      )?.details?.token as string | undefined;
      if (!token) throw new Error("the transfer request has no token");

      await acceptOrderTransferWorkflow(container).run({
        input: { order_id: order.id, token },
      });
      linked += 1;
    } catch (error) {
      logger.warn(
        `link-guest-orders: order #${order.display_id} stays a guest order: ${
          (error as Error).message
        }`,
      );
    }
  }

  return linked;
}
