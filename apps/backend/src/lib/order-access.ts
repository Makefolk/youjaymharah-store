import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * How long an order link works. Each order email carries a fresh one, so a
 * link from the shipping or delivery email covers the return window too.
 */
export const ORDER_ACCESS_TTL_MS = 60 * 24 * 60 * 60 * 1000;

function secret(): string {
  // Production refuses to boot without JWT_SECRET (environment-safety.ts).
  return process.env.JWT_SECRET || "supersecret";
}

function signature(orderId: string, expires: number): string {
  return createHmac("sha256", secret())
    .update(`order-access:${orderId}:${expires}`)
    .digest("base64url");
}

/**
 * The key in an order link (`/orders/:id?key=`) that opens the order without
 * signing in: its status, items, delivery address and contact details.
 * Emailed to the order's address and handed to the browser that placed it.
 * The order ID alone no longer opens anything, so an ID seen in a support
 * thread, a screenshot or a log is no key to the customer's details.
 */
export function createOrderAccessKey(orderId: string, now = Date.now()) {
  const expires = now + ORDER_ACCESS_TTL_MS;
  return `${expires}.${signature(orderId, expires)}`;
}

export function isValidOrderAccessKey(
  key: string | null | undefined,
  orderId: string,
  now = Date.now(),
): boolean {
  if (!key) return false;
  const [expiresText, given] = key.split(".");
  const expires = Number(expiresText);
  if (!given || !Number.isSafeInteger(expires) || expires <= now) return false;
  const actual = Buffer.from(given);
  const expected = Buffer.from(signature(orderId, expires));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
