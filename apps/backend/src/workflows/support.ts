import {
  createWorkflow,
  transform,
  WorkflowResponse,
} from "@medusajs/framework/workflows-sdk";

import type { SupportKind } from "../lib/support";
import { linkSupportRequestsStep } from "./steps/link-support-requests";
import { sendPreparedEmailsStep } from "./steps/send-prepared-email";
import {
  addSupportMessageStep,
  createSupportRequestStep,
  prepareSupportEmailsStep,
  updateSupportRequestStep,
  uploadSupportPhotosStep,
  type PhotoUpload,
  type UpdateSupportRequestInput,
} from "./steps/support";

export type CreateSupportRequestWorkflowInput = {
  kind: SupportKind;
  name: string;
  email: string;
  customer_id?: string | null;
  order_id?: string | null;
  order_display_id?: number | null;
  order_matched?: boolean | null;
  body: string;
  photos?: PhotoUpload[];
};

/**
 * A request from the contact page or an order's "Get help" form: stored with
 * its first message, emailed to the support inbox and acknowledged to the
 * customer with its reference and a link to follow it.
 */
export const createSupportRequestWorkflow = createWorkflow(
  "create-support-request",
  function (input: CreateSupportRequestWorkflowInput) {
    const photos = uploadSupportPhotosStep(input.photos);
    const created = createSupportRequestStep(
      transform({ input, photos }, ({ input, photos }) => ({
        kind: input.kind,
        name: input.name,
        email: input.email,
        customer_id: input.customer_id,
        order_id: input.order_id,
        order_display_id: input.order_display_id,
        body: input.body,
        photos,
      })),
    );
    const notifications = prepareSupportEmailsStep(
      transform({ created, input }, ({ created, input }) => ({
        request_id: created.request_id,
        message_id: created.message_id,
        event: "new" as const,
        order_matched: input.order_matched,
      })),
    );
    sendPreparedEmailsStep(notifications);
    return new WorkflowResponse(created);
  },
);

export type AddSupportMessageWorkflowInput = {
  request_id: string;
  author: "customer" | "staff";
  author_id?: string | null;
  author_name?: string | null;
  body: string;
  internal?: boolean;
  photos?: PhotoUpload[];
};

/** A message on a request, from the customer or staff, and who to tell. */
export const addSupportMessageWorkflow = createWorkflow(
  "add-support-message",
  function (input: AddSupportMessageWorkflowInput) {
    const photos = uploadSupportPhotosStep(input.photos);
    const added = addSupportMessageStep(
      transform({ input, photos }, ({ input, photos }) => ({
        request_id: input.request_id,
        author: input.author,
        author_id: input.author_id,
        author_name: input.author_name,
        body: input.body,
        internal: input.internal,
        photos,
      })),
    );
    const notifications = prepareSupportEmailsStep(
      transform({ added }, ({ added }) => ({
        request_id: added.request_id,
        message_id: added.message_id,
        event: "message" as const,
      })),
    );
    sendPreparedEmailsStep(notifications);
    return new WorkflowResponse(added);
  },
);

export const updateSupportRequestWorkflow = createWorkflow(
  "update-support-request",
  function (input: UpdateSupportRequestInput) {
    return new WorkflowResponse(updateSupportRequestStep(input));
  },
);

/** A verified customer's guest requests join their account. */
export const linkSupportRequestsWorkflow = createWorkflow(
  "link-support-requests",
  function (input: { customer_id: string; email: string }) {
    return new WorkflowResponse(linkSupportRequestsStep(input));
  },
);
