import type { MedusaResponse } from "@medusajs/framework/http";
import type { Logger } from "@medusajs/framework/types";
import { MedusaError } from "@medusajs/framework/utils";

import {
  isPrivatePhoto,
  type StoredPhoto,
  supportFileStore,
} from "../lib/support-files";

type MessageWithPhotos = { id: string; attachments?: unknown };

const photosOf = (message: MessageWithPhotos): StoredPhoto[] =>
  (message.attachments as { files?: StoredPhoto[] } | null)?.files ?? [];

/**
 * A message's photos as links. Private photos link to the photo route under
 * `base` (the request's own path, store or admin), which checks access
 * again; development's public photos keep their file URL.
 */
export function photoLinks(base: string, message: MessageWithPhotos) {
  return photosOf(message).map((photo, index) => ({
    url: isPrivatePhoto(photo)
      ? `${base}/photos/${message.id}/${index}`
      : photo.url,
    name: photo.name,
  }));
}

/**
 * Streams one photo of a message the caller may already see. Never cached
 * beyond the browser, and served so it can only display as an image.
 */
export async function sendSupportPhoto(
  res: MedusaResponse,
  logger: Logger,
  message: MessageWithPhotos | undefined,
  index: number,
) {
  const photo = message ? photosOf(message)[index] : undefined;
  if (!photo) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Photo not found.");
  }
  if (!isPrivatePhoto(photo)) {
    res.redirect(photo.url);
    return;
  }
  const store = supportFileStore(logger);
  if (!store) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Photo not found.");
  }
  const body = await store.getDownloadStream({ fileKey: photo.key });
  res.setHeader("content-type", photo.type);
  res.setHeader("cache-control", "private, max-age=300");
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("content-security-policy", "default-src 'none'");
  res.setHeader("content-disposition", "inline");
  body.on("error", (error) => {
    logger.warn(`Support photo ${photo.key} could not be read: ${error}`);
    res.destroy(error);
  });
  body.pipe(res);
}
