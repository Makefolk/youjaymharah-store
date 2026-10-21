import type { INotificationModuleService } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { BRANDING_MODULE } from "../../modules/branding";
import type BrandingModuleService from "../../modules/branding/service";
import { EmailTemplates } from "../../modules/resend/emails";
import { emailIdempotency } from "../../modules/resend/idempotency";
import type { ClaimSummary } from "../../modules/resend/emails/claim-created";
import { resolveReturnDestination } from "../utils/return-destination";

export type SendClaimCreatedEmailInput = {
  /** order.claim_created's `claim_id`. */
  claim_id: string;
};

export type SendClaimCreatedEmailOutput = {
  claim_id: string;
  order_id: string | null;
  sent_to: string | null;
};

export const sendClaimCreatedEmailStep = createStep(
  {
    name: "send-claim-created-email",
    // Transient Resend/network failures are retried by the workflow engine.
    // Permanent conditions below use StepResponse.permanentFailure instead.
    maxRetries: 5,
    retryInterval: 15,
  },
  async (input: SendClaimCreatedEmailInput, { container }) => {
    const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
    const query = container.resolve(ContainerRegistrationKeys.QUERY);
    const notificationModuleService: INotificationModuleService =
      container.resolve(Modules.NOTIFICATION);
    const brandingModuleService: BrandingModuleService =
      container.resolve(BRANDING_MODULE);

    const {
      data: [claim],
    } = await query.graph({
      entity: "order_claim",
      fields: [
        "id",
        "display_id",
        "type",
        "order_id",
        "no_notification",
        "canceled_at",
        "refund_amount",
        // Claim item `note`s are staff notes and are deliberately not read.
        "claim_items.quantity",
        "claim_items.reason",
        "claim_items.item.product_title",
        "claim_items.item.variant_title",
        "additional_items.quantity",
        "additional_items.item.product_title",
        "additional_items.item.variant_title",
        "return.location_id",
        "return.items.quantity",
        "return.items.item.product_title",
        "return.items.item.variant_title",
      ],
      filters: { id: input.claim_id },
    });

    if (!claim) {
      return StepResponse.permanentFailure(
        `send-claim-created-email: claim ${input.claim_id} could not be retrieved.`,
      );
    }

    if (claim.canceled_at || claim.no_notification) {
      logger.info(
        `send-claim-created-email: claim ${claim.id} is canceled or has notifications off; skipping.`,
      );
      return new StepResponse<SendClaimCreatedEmailOutput>({
        claim_id: claim.id,
        order_id: claim.order_id,
        sent_to: null,
      });
    }

    const {
      data: [order],
    } = await query.graph({
      entity: "order",
      // Exactly the fields the claim-created template reads.
      fields: [
        "id",
        "display_id",
        "email",
        "no_notification",
        "currency_code",
        "customer.first_name",
        "customer.email",
        "shipping_address.first_name",
        "summary.pending_difference",
      ],
      filters: { id: claim.order_id },
    });

    if (!order) {
      return StepResponse.permanentFailure(
        `send-claim-created-email: order ${claim.order_id} could not be retrieved.`,
      );
    }

    const recipient = order.email ?? order.customer?.email;

    if (!recipient || order.no_notification) {
      logger.info(
        `send-claim-created-email: order ${order.id} has no email or has notifications off; skipping.`,
      );
      return new StepResponse<SendClaimCreatedEmailOutput>({
        claim_id: claim.id,
        order_id: order.id,
        sent_to: null,
      });
    }

    const toLine = (
      item: {
        quantity?: unknown;
        item?: {
          product_title?: string | null;
          variant_title?: string | null;
        } | null;
      } | null,
    ) => ({
      title: item?.item?.product_title,
      variant_title: item?.item?.variant_title,
      quantity: Number(item?.quantity ?? 1),
    });

    const returnItems = (claim.return?.items ?? []).map(toLine);

    const summary: ClaimSummary = {
      id: claim.id,
      display_id: claim.display_id,
      type: claim.type,
      claimed_items: (claim.claim_items ?? []).map((item) => ({
        ...toLine(item),
        reason: item?.reason ?? null,
      })),
      replacement_items: (claim.additional_items ?? []).map(toLine),
      return_items: returnItems,
      // Only looked up when something is coming back.
      location: returnItems.length
        ? await resolveReturnDestination(container, claim.return?.location_id)
        : null,
      refund_amount:
        claim.refund_amount == null ? null : Number(claim.refund_amount),
      pending_difference: Number(order.summary?.pending_difference ?? 0),
    };

    const brand = await brandingModuleService.retrieveSettings();

    // Deliberately not caught: a throw is what schedules the retry.
    await notificationModuleService.createNotifications({
      to: recipient,
      channel: "email",
      resource_type: "order",
      resource_id: order.id,
      template: EmailTemplates.CLAIM_CREATED,
      ...emailIdempotency(`claim-created:${input.claim_id}`),
      data: { order, claim: summary, brand },
    });

    logger.info(
      `send-claim-created-email: claim email sent to ${recipient} for order #${order.display_id}.`,
    );

    return new StepResponse<SendClaimCreatedEmailOutput>({
      claim_id: claim.id,
      order_id: order.id,
      sent_to: recipient,
    });
  },
);
