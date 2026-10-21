/**
 * What changes the content of a catalogue response. Prices depend on the region,
 * and with translations on, text depends on the locale -- a key without either
 * would serve one region's prices or one language's copy to everyone.
 */
export type CatalogContext = {
  regionId: string
  locale: string
}

export const queryKeys = {
  customer: {
    all: ["customer"] as const,
    me: () => [...queryKeys.customer.all, "me"] as const,
    emailVerification: () =>
      [...queryKeys.customer.all, "email-verification"] as const,
  },
  cart: {
    all: ["cart"] as const,
    current: () => [...queryKeys.cart.all, "current"] as const,
    /** Under the cart root, so signing out removes them with it. */
    shippingOptions: (cartId: string) =>
      [...queryKeys.cart.all, "shipping-options", cartId] as const,
  },
  paymentProviders: {
    all: ["payment-providers"] as const,
    region: (regionId: string) =>
      [...queryKeys.paymentProviders.all, regionId] as const,
  },
  wishlist: {
    all: ["wishlist"] as const,
    current: () => [...queryKeys.wishlist.all, "current"] as const,
  },
  productAlerts: {
    all: ["product-alerts"] as const,
    mine: () => [...queryKeys.productAlerts.all, "mine"] as const,
  },
  marketing: {
    all: ["marketing"] as const,
    preference: () => [...queryKeys.marketing.all, "preference"] as const,
  },
  sizeGuide: {
    all: ["size-guide"] as const,
    product: (productId: string) =>
      [...queryKeys.sizeGuide.all, "product", productId] as const,
  },
  newsletter: {
    all: ["newsletter"] as const,
    settings: () => [...queryKeys.newsletter.all, "settings"] as const,
  },
  search: {
    all: ["search"] as const,
    suggestions: (term: string) =>
      [...queryKeys.search.all, "suggestions", term] as const,
    trending: () => [...queryKeys.search.all, "trending"] as const,
  },
  listing: {
    all: ["listing"] as const,
    results: (
      scope: Record<string, string | undefined>,
      state: Record<string, unknown>,
      regionId: string,
      defaultSort: string,
    ) =>
      [
        ...queryKeys.listing.all,
        "results",
        scope,
        state,
        regionId,
        defaultSort,
      ] as const,
    count: (
      scope: Record<string, string | undefined>,
      state: Record<string, unknown>,
      regionId: string,
    ) => [...queryKeys.listing.all, "count", scope, state, regionId] as const,
  },
  products: {
    all: ["products"] as const,
    list: (params: Record<string, unknown>, context: CatalogContext) =>
      [...queryKeys.products.all, "list", params, context] as const,
    detail: (handle: string, context: CatalogContext) =>
      [...queryKeys.products.all, "detail", handle, context] as const,
  },
} as const

/**
 * Data that belongs to whoever is signed in. Removed (not just invalidated) on
 * logout, so the previous customer's details never flash on screen.
 */
export const privateQueryRoots = [
  queryKeys.customer.all,
  queryKeys.cart.all,
  queryKeys.wishlist.all,
  queryKeys.productAlerts.all,
  queryKeys.marketing.all,
] as const
