import type {
  CreateNotificationDTO,
  IFileModuleService,
} from "@medusajs/framework/types";
import { MedusaError, Modules } from "@medusajs/framework/utils";
import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import {
  checkAttachment,
  createSupportAccessToken,
  MAX_ATTACHMENTS,
  newSupportReference,
  SUPPORT_KIND_LABELS,
  type SupportKind,
} from "../../lib/support";
import { BRANDING_MODULE } from "../../modules/branding";
import type BrandingModuleService from "../../modules/branding/service";
import { EmailTemplates } from "../../modules/resend/emails";
import {
  ADMIN_URL,
  STOREFRONT_URL,
  SUPPORT_EMAIL,
} from "../../modules/resend/emails/constants";
import { emailIdempotency } from "../../modules/resend/idempotency";
import { STOREFRONT_SETTINGS_MODULE } from "../../modules/storefront-settings";
import type StorefrontSettingsModuleService from "../../modules/storefront-settings/service";
import { completeSupportInfo } from "../../modules/storefront-settings/support-info";
import { SUPPORT_MODULE } from "../../modules/support";
import type SupportModuleService from "../../modules/support/service";

export type PhotoUpload = { name: string; data: string };
export type StoredPhoto = { url: string; name: string };

/**
 * Checks each photo by its bytes, then stores it. Undone by deleting what
 * was stored, if a later step fails.
 */
export const uploadSupportPhotosStep = createStep(
  "upload-support-photos",
  async (photos: PhotoUpload[] | undefined, { container }) => {
    const list = photos ?? [];
    if (list.length > MAX_ATTACHMENTS) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Attach up to ${MAX_ATTACHMENTS} photos.`,
      );
    }
    const checked = list.map((photo) => {
      const result = checkAttachment(photo.data);
      if (!result.ok)
        throw new MedusaError(MedusaError.Types.INVALID_DATA, result.error);
      return { ...photo, type: result.type };
    });
    if (!checked.length)
      return new StepResponse<StoredPhoto[], string[]>([], []);

    const files: IFileModuleService = container.resolve(Modules.FILE);
    const stored = await files.createFiles(
      checked.map((photo) => ({
        filename: photo.name.replace(/[^\w.-]+/g, "-").slice(0, 80) || "photo",
        mimeType: photo.type,
        content: photo.data,
        access: "public" as const,
      })),
    );
    return new StepResponse(
      stored.map((file, index) => ({
        url: file.url,
        name: checked[index].name,
      })),
      stored.map((file) => file.id),
    );
  },
  async (ids, { container }) => {
    if (!ids?.length) return;
    const files: IFileModuleService = container.resolve(Modules.FILE);
    await files.deleteFiles(ids);
  },
);

export type CreateSupportRequestInput = {
  kind: SupportKind;
  name: string;
  email: string;
  customer_id?: string | null;
  order_id?: string | null;
  order_display_id?: number | null;
  body: string;
  photos: StoredPhoto[];
};

export const createSupportRequestStep = createStep(
  "create-support-request",
  async (input: CreateSupportRequestInput, { container }) => {
    const service: SupportModuleService = container.resolve(SUPPORT_MODULE);
    const now = new Date();
    // References are random; on the rare clash, draw again.
    let reference = newSupportReference();
    for (let attempt = 0; attempt < 5; attempt++) {
      const [taken] = await service.listSupportRequests(
        { reference },
        { take: 1, select: ["id"] },
      );
      if (!taken) break;
      reference = newSupportReference();
    }
    const request = await service.createSupportRequests({
      reference,
      kind: input.kind,
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      customer_id: input.customer_id ?? null,
      order_id: input.order_id ?? null,
      order_display_id: input.order_display_id ?? null,
      last_message_at: now,
    });
    const message = await service.createSupportMessages({
      request_id: request.id,
      author: "customer",
      author_name: input.name.trim(),
      body: input.body.trim(),
      attachments: input.photos.length ? { files: input.photos } : null,
    });
    return new StepResponse(
      { request_id: request.id, message_id: message.id },
      request.id,
    );
  },
  async (requestId, { container }) => {
    if (!requestId) return;
    const service: SupportModuleService = container.resolve(SUPPORT_MODULE);
    await service.deleteSupportRequests(requestId);
  },
);

export type AddSupportMessageInput = {
  request_id: string;
  author: "customer" | "staff";
  author_id?: string | null;
  author_name?: string | null;
  body: string;
  internal?: boolean;
  photos: StoredPhoto[];
};

/**
 * Adds a message and moves the status along: a customer message reopens the
 * request; a staff reply (not a note) waits on the customer.
 */
export const addSupportMessageStep = createStep(
  "add-support-message",
  async (input: AddSupportMessageInput, { container }) => {
    const service: SupportModuleService = container.resolve(SUPPORT_MODULE);
    const request = await service.retrieveSupportRequest(input.request_id);
    const internal = input.author === "staff" && Boolean(input.internal);

    const message = await service.createSupportMessages({
      request_id: request.id,
      author: input.author,
      author_id: input.author_id ?? null,
      author_name: input.author_name ?? null,
      body: input.body.trim(),
      internal,
      attachments: input.photos.length ? { files: input.photos } : null,
    });
    const status = internal
      ? request.status
      : input.author === "customer"
        ? "open"
        : "awaiting_customer";
    await service.updateSupportRequests({
      id: request.id,
      status,
      ...(internal ? {} : { last_message_at: new Date() }),
    });
    return new StepResponse(
      { request_id: request.id, message_id: message.id },
      {
        message_id: message.id,
        request_id: request.id,
        status: request.status,
        last_message_at: request.last_message_at,
      },
    );
  },
  async (previous, { container }) => {
    if (!previous) return;
    const service: SupportModuleService = container.resolve(SUPPORT_MODULE);
    await service.deleteSupportMessages(previous.message_id);
    await service.updateSupportRequests({
      id: previous.request_id,
      status: previous.status,
      last_message_at: previous.last_message_at,
    });
  },
);

export type PrepareSupportEmailsInput = {
  request_id: string;
  message_id: string;
  /** new: a request was made. message: a message was added to one. */
  event: "new" | "message";
  /** For contact-page requests that gave an order number. */
  order_matched?: boolean | null;
};

/**
 * Who hears about it: a new request emails staff and acknowledges to the
 * customer; a customer message emails staff; a staff reply emails the
 * customer; a staff note emails nobody.
 */
export const prepareSupportEmailsStep = createStep(
  "prepare-support-emails",
  async (input: PrepareSupportEmailsInput, { container }) => {
    const service: SupportModuleService = container.resolve(SUPPORT_MODULE);
    const branding: BrandingModuleService = container.resolve(BRANDING_MODULE);
    const settings: StorefrontSettingsModuleService = container.resolve(
      STOREFRONT_SETTINGS_MODULE,
    );
    const [request, message, brand, storefront] = await Promise.all([
      service.retrieveSupportRequest(input.request_id),
      service.retrieveSupportMessage(input.message_id),
      branding.retrieveSettings(),
      settings.retrieveSettings(),
    ]);

    const customerUrl = `${STOREFRONT_URL.replace(/\/$/, "")}/support/${request.id}?access=${createSupportAccessToken(request.id, request.email)}`;
    const adminUrl = `${ADMIN_URL.replace(/\/$/, "")}/support-inbox/${request.id}`;
    const photos =
      (message.attachments as { files?: StoredPhoto[] } | null)?.files ?? [];
    const notifications: CreateNotificationDTO[] = [];

    const toStaff = (event: "new" | "reply"): CreateNotificationDTO => ({
      to: brand.support_email || SUPPORT_EMAIL,
      channel: "email",
      template: EmailTemplates.SUPPORT_STAFF,
      resource_type: request.order_id ? "order" : undefined,
      resource_id: request.order_id ?? undefined,
      ...emailIdempotency(`support-staff:${message.id}`),
      data: {
        event,
        reference: request.reference,
        kind_label: SUPPORT_KIND_LABELS[request.kind as SupportKind],
        name: request.name,
        email: request.email,
        order_number: request.order_display_id,
        order_matched: input.order_matched ?? null,
        message: message.body,
        photos,
        admin_url: adminUrl,
        // Replying from the support inbox answers the customer.
        reply_to: request.email,
        brand,
      },
    });
    const toCustomer = (
      event: "received" | "reply",
    ): CreateNotificationDTO => ({
      to: request.email,
      channel: "email",
      template: EmailTemplates.SUPPORT_CUSTOMER,
      resource_type: request.order_id ? "order" : undefined,
      resource_id: request.order_id ?? undefined,
      ...emailIdempotency(`support-customer:${message.id}`),
      data: {
        event,
        reference: request.reference,
        name: request.name,
        message: message.body,
        url: customerUrl,
        response_time: completeSupportInfo(storefront.support_info)
          .response_time,
        brand,
      },
    });

    if (input.event === "new") {
      notifications.push(toStaff("new"), toCustomer("received"));
    } else if (message.author === "customer") {
      notifications.push(toStaff("reply"));
    } else if (!message.internal) {
      notifications.push(toCustomer("reply"));
    }
    return new StepResponse(notifications);
  },
);

export type UpdateSupportRequestInput = {
  id: string;
  status?: "open" | "awaiting_customer" | "resolved";
  priority?: "normal" | "high";
  assigned_to?: string | null;
};

export const updateSupportRequestStep = createStep(
  "update-support-request",
  async (input: UpdateSupportRequestInput, { container }) => {
    const service: SupportModuleService = container.resolve(SUPPORT_MODULE);
    const previous = await service.retrieveSupportRequest(input.id);
    const updated = await service.updateSupportRequests({
      id: input.id,
      ...(input.status ? { status: input.status } : {}),
      ...(input.priority ? { priority: input.priority } : {}),
      ...(input.assigned_to !== undefined
        ? { assigned_to: input.assigned_to }
        : {}),
    });
    return new StepResponse(updated, {
      id: previous.id,
      status: previous.status,
      priority: previous.priority,
      assigned_to: previous.assigned_to,
    });
  },
  async (previous, { container }) => {
    if (!previous) return;
    const service: SupportModuleService = container.resolve(SUPPORT_MODULE);
    await service.updateSupportRequests(previous);
  },
);
