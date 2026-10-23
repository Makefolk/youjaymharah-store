import { createOrderAccessKey } from "../../../lib/order-access";

/**
 * Fallbacks only. The live values come from the `branding` module and are
 * passed into each template as a `brand` prop by the subscriber that sends it.
 * These keep an email readable if branding has not been set yet, or if a
 * caller renders a template without one.
 */
export const STORE_NAME = process.env.STORE_NAME ?? "Youjaymharah";
export const SUPPORT_EMAIL =
  process.env.SUPPORT_EMAIL ?? "support@youjaymharah.com";
export const STOREFRONT_URL =
  process.env.STOREFRONT_URL ?? "http://localhost:8000";

/**
 * An order's status page on the storefront, where the customer can track it
 * and request a return. Must match `orderPath` in the storefront's
 * lib/seo/routes.ts. Carries a fresh order access key, so the link opens the
 * order without signing in for a while (lib/order-access.ts).
 */
export const orderPageUrl = (orderId: string) =>
  `${STOREFRONT_URL.replace(/\/$/, "")}/orders/${encodeURIComponent(orderId)}?key=${encodeURIComponent(createOrderAccessKey(orderId))}`;
/**
 * Base URL of the admin dashboard, used for invite and staff reset links.
 * Includes the path when the backend serves it (`https://api.example.com/app`);
 * just the origin when the dashboard is deployed on its own host.
 */
export const ADMIN_URL = (
  process.env.ADMIN_URL ?? "http://localhost:9000/app"
).replace(/\/$/, "");

/** The branding fields an email needs. Mirrors the `branding` model. */
export type BrandSummary = {
  name?: string | null;
  logo_url?: string | null;
  support_email?: string | null;
};
