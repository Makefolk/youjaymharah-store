import type { Readable } from "node:stream";
import type { Logger } from "@medusajs/framework/types";
import s3Provider from "@medusajs/medusa/file-s3";

/** A photo in the private support bucket. */
export type PrivatePhoto = { key: string; name: string; type: string };
/** A photo stored publicly by the file module, in development only. */
export type PublicPhoto = { url: string; name: string };
export type StoredPhoto = PrivatePhoto | PublicPhoto;

export const isPrivatePhoto = (photo: StoredPhoto): photo is PrivatePhoto =>
  "key" in photo;

type S3Store = {
  upload(file: {
    filename: string;
    mimeType: string;
    content: string;
  }): Promise<{ key: string }>;
  delete(files: { fileKey: string }[]): Promise<void>;
  getDownloadStream(file: { fileKey: string }): Promise<Readable>;
};

type S3StoreClass = new (
  deps: { logger: Logger },
  options: Record<string, unknown>,
) => S3Store;

let store: S3Store | null | undefined;

/**
 * Customer photos (damage, wrong item) live in their own bucket, which must
 * have no public access: the main bucket serves product images to anyone
 * who has a URL, and on R2 an object's "private" flag doesn't change that.
 * The backend streams each photo only after checking who is asking.
 *
 * Uses Medusa's own S3 provider, with the main bucket's credentials and
 * SUPPORT_FILES_BUCKET. Null when that isn't set.
 */
export function supportFileStore(logger: Logger): S3Store | null {
  if (store !== undefined) return store;
  const bucket = process.env.SUPPORT_FILES_BUCKET;
  if (!bucket) return (store = null);
  const [S3FileService] = s3Provider.services as unknown as [S3StoreClass];
  store = new S3FileService(
    { logger },
    {
      file_url: "",
      access_key_id: process.env.S3_ACCESS_KEY_ID,
      secret_access_key: process.env.S3_SECRET_ACCESS_KEY,
      region: process.env.S3_REGION,
      bucket,
      endpoint: process.env.S3_ENDPOINT,
      prefix: "support/",
      cache_control: "private, no-store",
      acl: false,
    },
  );
  return store;
}
