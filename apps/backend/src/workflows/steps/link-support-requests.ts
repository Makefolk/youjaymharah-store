import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import { SUPPORT_MODULE } from "../../modules/support";
import type SupportModuleService from "../../modules/support/service";

/**
 * Requests sent as a guest from this email join the account, so the
 * customer sees them under Account › Support. Only after the email is
 * verified (anyone can register any address).
 */
export const linkSupportRequestsStep = createStep(
  "link-support-requests",
  async (input: { customer_id: string; email: string }, { container }) => {
    const service: SupportModuleService = container.resolve(SUPPORT_MODULE);
    const guest = await service.listSupportRequests(
      { email: input.email.trim().toLowerCase(), customer_id: null },
      { select: ["id"] },
    );
    if (guest.length) {
      await service.updateSupportRequests(
        guest.map((request) => ({
          id: request.id,
          customer_id: input.customer_id,
        })),
      );
    }
    return new StepResponse(
      guest.length,
      guest.map((request) => request.id),
    );
  },
  async (ids, { container }) => {
    if (!ids?.length) return;
    const service: SupportModuleService = container.resolve(SUPPORT_MODULE);
    await service.updateSupportRequests(
      ids.map((id) => ({ id, customer_id: null })),
    );
  },
);
