import type {
  CreateNotificationDTO,
  INotificationModuleService,
} from "@medusajs/framework/types";
import { Modules } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

export type PreparedEmail<T> = {
  notification: CreateNotificationDTO | null;
  result: T;
};

// The preparation step's persisted output keeps token, recipient and content
// fixed while the workflow retries a send whose result may have been lost.
export const sendPreparedEmailStep = createStep(
  { name: "send-prepared-email", maxRetries: 5, retryInterval: 15 },
  async (notification: CreateNotificationDTO | null, { container }) => {
    if (notification) {
      const service: INotificationModuleService = container.resolve(
        Modules.NOTIFICATION,
      );
      await service.createNotifications(notification);
    }
    return new StepResponse(null);
  },
);

/** Several prepared emails at once; each keeps its own idempotency key. */
export const sendPreparedEmailsStep = createStep(
  { name: "send-prepared-emails", maxRetries: 5, retryInterval: 15 },
  async (notifications: CreateNotificationDTO[], { container }) => {
    if (notifications.length) {
      const service: INotificationModuleService = container.resolve(
        Modules.NOTIFICATION,
      );
      await service.createNotifications(notifications);
    }
    return new StepResponse(null);
  },
);
