import type { MedusaContainer } from "@medusajs/framework/types";
import {
  ContainerRegistrationKeys,
  MedusaError,
  ProductStatus,
  QueryContext,
} from "@medusajs/framework/utils";

import type { ListingProduct } from "../../lib/catalog-listing";
import {
  findPurchasableVariantIds,
  LAUNCHED_AT_METADATA_KEY,
  type AlertProduct,
} from "./product-availability";

export type ListingScope = {
  /** A category handle; its subcategories' products are included. */
  category?: string;
  collection?: string;
};

const text = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

/**
 * `metadata.fit` as a filter value, when it is a short label such as
 * "Relaxed" or "Oversized fit". Product pages also use the field for a
 * sentence ("Oversized fit. The model is 175cm...") or measurements, which
 * would make every product its own filter value, so those are left out.
 */
function fitLabel(value: unknown): string | null {
  const label = text(value);
  return label && label.length <= 24 && !/[.:\d]/.test(label) ? label : null;
}

const sameTitle = (a: unknown, b: string) =>
  typeof a === "string" && a.toLowerCase() === b.toLowerCase();

/** The products in a category and every category under it. */
async function categoryProductIds(
  container: MedusaContainer,
  handle: string,
): Promise<string[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data: categories } = await query.graph({
    entity: "product_category",
    fields: ["id", "handle", "parent_category_id"],
    filters: { is_active: true, is_internal: false },
    pagination: { take: 1000 },
  });
  const root = categories.find((category) => category.handle === handle);
  if (!root) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Category not found.");
  }
  const ids = [root.id];
  for (let i = 0; i < ids.length; i++) {
    for (const category of categories) {
      if (category.parent_category_id === ids[i]) ids.push(category.id);
    }
  }
  const { data: withProducts } = await query.graph({
    entity: "product_category",
    fields: ["products.id"],
    filters: { id: ids },
    pagination: { take: 1000 },
  });
  return [
    ...new Set(
      withProducts.flatMap((category: any) =>
        (category.products ?? []).map((product: any) => product?.id),
      ),
    ),
  ].filter((id): id is string => Boolean(id));
}

/**
 * The published products a listing shows in one sales channel, reduced to
 * what filtering, sorting and counting need, with prices in the region.
 */
export async function loadListingProducts(
  container: MedusaContainer,
  {
    scope,
    regionId,
    salesChannelIds,
  }: {
    scope: ListingScope;
    regionId: string;
    salesChannelIds: string[];
  },
): Promise<ListingProduct[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const {
    data: [region],
  } = await query.graph({
    entity: "region",
    fields: ["id", "currency_code"],
    filters: { id: regionId },
  });
  if (!region) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "Region not found.");
  }

  let collectionId: string | undefined;
  if (scope.collection) {
    const {
      data: [collection],
    } = await query.graph({
      entity: "product_collection",
      fields: ["id"],
      filters: { handle: scope.collection },
    });
    if (!collection) {
      throw new MedusaError(
        MedusaError.Types.NOT_FOUND,
        "Collection not found.",
      );
    }
    collectionId = collection.id;
  }

  // Products can't be filtered by category in query.graph, so the category
  // side supplies their ids.
  const productIds = scope.category
    ? await categoryProductIds(container, scope.category)
    : undefined;
  if (productIds && !productIds.length) return [];

  const { data: products } = await query.graph({
    entity: "product",
    fields: [
      "id",
      "title",
      "handle",
      "thumbnail",
      "status",
      "created_at",
      "metadata",
      "material",
      "type.value",
      "tags.value",
      "sales_channels.id",
      "variants.id",
      "variants.title",
      "variants.manage_inventory",
      "variants.allow_backorder",
      "variants.options.value",
      "variants.options.rank",
      "variants.options.metadata",
      "variants.options.option.title",
      "variants.calculated_price.calculated_amount",
    ],
    filters: {
      status: ProductStatus.PUBLISHED,
      ...(productIds ? { id: productIds } : {}),
      ...(collectionId ? { collection_id: collectionId } : {}),
    },
    pagination: { take: 2000 },
    context: {
      variants: {
        calculated_price: QueryContext({
          region_id: region.id,
          currency_code: region.currency_code,
        }),
      },
    },
  });

  // Sales channels are a link, which query.graph can't filter by.
  const inChannel = products.filter((product: any) =>
    (product.sales_channels ?? []).some((channel: any) =>
      salesChannelIds.includes(channel?.id),
    ),
  );

  const purchasable = salesChannelIds.length
    ? await findPurchasableVariantIds(
        container,
        inChannel.map((product: any): AlertProduct => ({
          id: product.id,
          title: product.title,
          handle: product.handle,
          thumbnail: product.thumbnail,
          status: product.status,
          metadata: product.metadata ?? null,
          variants: (product.variants ?? []).map((variant: any) => ({
            id: variant.id,
            title: variant.title ?? null,
            manage_inventory: Boolean(variant.manage_inventory),
            allow_backorder: Boolean(variant.allow_backorder),
          })),
        })),
        salesChannelIds[0],
      )
    : new Set<string>();

  return inChannel.map((product: any): ListingProduct => {
    const colours = new Map<string, ListingProduct["colours"][number]>();
    const sizes = new Map<string, ListingProduct["sizes"][number]>();
    const prices: number[] = [];

    for (const variant of product.variants ?? []) {
      const amount = variant.calculated_price?.calculated_amount;
      if (typeof amount === "number") prices.push(amount);
      for (const value of variant.options ?? []) {
        if (!value?.value) continue;
        const rank =
          typeof value.rank === "number" ? value.rank : Number.MAX_SAFE_INTEGER;
        if (sameTitle(value.option?.title, "Colour")) {
          const hex = text(value.metadata?.hex);
          colours.set(value.value, {
            value: value.value,
            hex: hex && /^#[0-9a-f]{3,8}$/i.test(hex) ? hex : null,
            rank,
          });
        } else if (sameTitle(value.option?.title, "Size")) {
          sizes.set(value.value, { value: value.value, rank });
        }
      }
    }

    return {
      id: product.id,
      listed_at:
        text(product.metadata?.[LAUNCHED_AT_METADATA_KEY]) ??
        new Date(product.created_at).toISOString(),
      type: text(product.type?.value),
      material: text(product.material),
      fit: fitLabel(product.metadata?.fit),
      tags: (product.tags ?? [])
        .map((tag: any) => text(tag?.value))
        .filter((tag: string | null): tag is string => Boolean(tag)),
      colours: [...colours.values()],
      sizes: [...sizes.values()],
      price: prices.length ? Math.min(...prices) : null,
      available: (product.variants ?? []).some((variant: any) =>
        purchasable.has(variant.id),
      ),
    };
  });
}
