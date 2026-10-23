import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework";
import type { ICachingModuleService } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

import { refreshStorefrontCacheWorkflow } from "../workflows/refresh-storefront-cache";

/** The storefront's cache tags for each kind of catalog change. */
const TAGS: Record<string, string[]> = {
  product: ["products"],
  "product-category": ["categories", "products"],
  "product-collection": ["collections", "products"],
};

/** An import fires an event per product; one refresh covers a burst. */
const BURST_SECONDS = 5;

/**
 * Admin catalog edits show on the storefront's next visit, not when its
 * cache expires (a minute for products, five for categories and
 * collections). Best effort: the cache still expires on its own.
 */
export default async function catalogChangedHandler({
  event: { name },
  container,
}: SubscriberArgs<{ id: string }>) {
  const tags = TAGS[name.slice(0, name.lastIndexOf("."))];
  if (!tags) return;

  try {
    const cache: ICachingModuleService = container.resolve(Modules.CACHING);
    const key = `storefront-refresh:${tags.join(",")}`;
    if (await cache.get({ key })) return;
    await cache.set({ key, data: { at: Date.now() }, ttl: BURST_SECONDS });
  } catch {
    // Without the cache, refresh every time rather than not at all.
  }

  try {
    await refreshStorefrontCacheWorkflow(container).run({ input: { tags } });
  } catch {
    container
      .resolve(ContainerRegistrationKeys.LOGGER)
      .warn(
        `${name}: could not ask the storefront to refresh ${tags.join(", ")}.`,
      );
  }
}

export const config: SubscriberConfig = {
  event: Object.keys(TAGS).flatMap((entity) =>
    ["created", "updated", "deleted"].map((action) => `${entity}.${action}`),
  ),
};
