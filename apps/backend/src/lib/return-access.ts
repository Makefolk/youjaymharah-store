import { createHmac, timingSafeEqual } from "node:crypto";

/** How long an emailed return link works. */
export const RETURN_ACCESS_TTL_MS = 24 * 60 * 60 * 1000;

function secret(): string {
  const value = process.env.JWT_SECRET;
  if (value) return value;
  // Production refuses to boot without JWT_SECRET (environment-safety.ts);
  // elsewhere Medusa itself falls back to this same development value.
  return "supersecret";
}

function signature(orderId: string, email: string, expires: number): string {
  return createHmac("sha256", secret())
    .update(`return-access:${orderId}:${email.trim().toLowerCase()}:${expires}`)
    .digest("base64url");
}

/**
 * A guest's proof that they can read the order's inbox: emailed there, and
 * required to request a return without signing in. Knowing the order's email
 * is no proof, since anyone with the order's link can see it.
 *
 * Bound to the order's email, so changing the email voids old links.
 */
export function createReturnAccessToken(
  orderId: string,
  email: string,
  now = Date.now(),
): string {
  const expires = now + RETURN_ACCESS_TTL_MS;
  return `${expires}.${signature(orderId, email, expires)}`;
}

export function isValidReturnAccessToken(
  token: string | null | undefined,
  orderId: string,
  email: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!token || !email) return false;
  const [expiresText, given] = token.split(".");
  const expires = Number(expiresText);
  if (!given || !Number.isSafeInteger(expires) || expires <= now) return false;
  const actual = Buffer.from(given);
  const expected = Buffer.from(signature(orderId, email, expires));
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
