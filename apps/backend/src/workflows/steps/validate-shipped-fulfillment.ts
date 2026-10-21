import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

export type ValidateShippedFulfillmentInput = {
  order_id: string;
  fulfillment_id: string;
};

/**
 * Only a shipment of this order can have its shipping email resent: a
 * fulfillment from another order would email the wrong customer, and one not
 * yet shipped (or canceled) has no shipment to tell them about.
 */
export const validateShippedFulfillmentStep = createStep(
  "validate-shipped-fulfillment",
  async (input: ValidateShippedFulfillmentInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const {
      data: [order],
    } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "fulfillments.id",
        "fulfillments.shipped_at",
        "fulfillments.canceled_at",
      ],
      filters: { id: input.order_id },
    });

    if (!order) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "Order not found.");
    }

    const fulfillment = (order.fulfillments ?? []).find(
      (entry) => entry?.id === input.fulfillment_id,
    );

    if (!fulfillment) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "That shipment isn't part of this order.",
      );
    }
    if (!fulfillment.shipped_at || fulfillment.canceled_at) {
      throw new MedusaError(
        MedusaError.Types.NOT_ALLOWED,
        "Only a shipped, uncanceled fulfillment has a shipping email to resend.",
      );
    }

    return new StepResponse(input);
  },
);
