import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

export const SUPPORT_KINDS = [
  "question",
  "order",
  "delivery",
  "return",
  "product",
  "cancel",
  "change_address",
  "exchange",
  "damaged",
  "missing",
] as const;
export type SupportKind = (typeof SUPPORT_KINDS)[number];

/** How each kind reads, to customers and in staff emails. */
export const SUPPORT_KIND_LABELS: Record<SupportKind, string> = {
  question: "A question",
  order: "An order",
  delivery: "Delivery",
  return: "A return or refund",
  product: "A product or sizing",
  cancel: "Cancel the order",
  change_address: "Change the delivery address",
  exchange: "Exchange for another size",
  damaged: "Damaged or faulty item",
  missing: "Missing or wrong item",
};

/** The contact page's topics, as kinds. */
export const CONTACT_TOPIC_KINDS: Record<string, SupportKind> = {
  "An order": "order",
  Delivery: "delivery",
  "A return or refund": "return",
  "A product or sizing": "product",
  "Something else": "question",
};

/** No 0/O or 1/I, so a reference read over the phone isn't misheard. */
const REFERENCE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function newSupportReference(): string {
  let code = "";
  for (let i = 0; i < 6; i++)
    code += REFERENCE_ALPHABET[randomInt(REFERENCE_ALPHABET.length)];
  return `SR-${code}`;
}

function secret(): string {
  // Production refuses to boot without JWT_SECRET (environment-safety.ts).
  return process.env.JWT_SECRET || "supersecret";
}

function sign(requestId: string, email: string): string {
  return createHmac("sha256", secret())
    .update(`support-access:${requestId}:${email.trim().toLowerCase()}`)
    .digest("base64url");
}

/**
 * The key in a request's email links that lets a guest read and answer it.
 * Bound to the request and its email; it doesn't expire, as a conversation
 * can run for weeks, but it only ever opens that one request.
 */
export const createSupportAccessToken = (requestId: string, email: string) =>
  sign(requestId, email);

export function isValidSupportAccessToken(
  token: string | null | undefined,
  requestId: string,
  email: string,
): boolean {
  if (!token) return false;
  const actual = Buffer.from(token);
  const expected = Buffer.from(sign(requestId, email));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

/** Photos a customer can attach to a message. */
export const MAX_ATTACHMENTS = 3;
export const MAX_ATTACHMENT_BYTES = 3 * 1024 * 1024;

const SIGNATURES: { type: string; matches: (bytes: Buffer) => boolean }[] = [
  { type: "image/jpeg", matches: (b) => b[0] === 0xff && b[1] === 0xd8 },
  {
    type: "image/png",
    matches: (b) => b.subarray(0, 8).toString("hex") === "89504e470d0a1a0a",
  },
  {
    type: "image/webp",
    matches: (b) =>
      b.subarray(0, 4).toString("ascii") === "RIFF" &&
      b.subarray(8, 12).toString("ascii") === "WEBP",
  },
];

/**
 * Checks a photo by its bytes, not its declared type, so nothing but a
 * JPEG, PNG or WebP image is stored. Returns its real type, or an error.
 */
export function checkAttachment(
  base64: string,
): { ok: true; type: string; bytes: number } | { ok: false; error: string } {
  const bytes = Buffer.from(base64, "base64");
  if (!bytes.length) return { ok: false, error: "A photo is empty." };
  if (bytes.length > MAX_ATTACHMENT_BYTES)
    return { ok: false, error: "Each photo must be 3 MB or smaller." };
  const match = SIGNATURES.find((signature) => signature.matches(bytes));
  return match
    ? { ok: true, type: match.type, bytes: bytes.length }
    : { ok: false, error: "Only JPEG, PNG or WebP photos can be attached." };
}
