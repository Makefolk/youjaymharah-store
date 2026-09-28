import {
  authenticate,
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http";
import type { BaseEntity } from "@medusajs/framework/types";
import { z } from "@medusajs/framework/zod";
import { errorHandler as defaultErrorHandler } from "@medusajs/framework/http";

import { rateLimit } from "./rate-limit";
import { reportRequestError } from "./report-error";
import {
  NEWSLETTER_DESCRIPTION_MAX,
  NEWSLETTER_HEADING_MAX,
} from "../modules/newsletter/copy";
import {
  UpdateSearchFallbackTerms,
  UpdateSearchVocabulary,
} from "../modules/search-insights/vocabulary-input";
import {
  AnnouncementBar,
  AnnouncementOptionsQuery,
} from "../modules/storefront-settings/announcements";

export const AdminUpdateBranding = z.object({
  name: z.string().min(1).optional(),
  logo_url: z.url().nullable().optional(),
  favicon_url: z.url().nullable().optional(),
  support_email: z.email().nullable().optional(),
});

export type AdminUpdateBrandingType = z.infer<typeof AdminUpdateBranding>;

export const AdminUpdateNewsletterSettings = z.object({
  enabled: z.boolean().optional(),
  audience_id: z.string().nullable().optional(),
  double_opt_in: z.boolean().optional(),
  heading: z.string().max(NEWSLETTER_HEADING_MAX).nullable().optional(),
  description: z.string().max(NEWSLETTER_DESCRIPTION_MAX).nullable().optional(),
  consent_text: z.string().nullable().optional(),
  success_message: z.string().nullable().optional(),
  reply_to: z.email().nullable().optional(),
  checkout_opt_in: z.boolean().optional(),
  checkout_label: z.string().nullable().optional(),
});

export type AdminUpdateNewsletterSettingsType = z.infer<
  typeof AdminUpdateNewsletterSettings
>;

export const StoreNewsletterSubscribe = z.object({
  email: z.email(),
  source: z.string().max(64).optional(),
});

export type StoreNewsletterSubscribeType = z.infer<
  typeof StoreNewsletterSubscribe
>;

export const StoreNewsletterToken = z.object({
  token: z.string().min(16).max(256),
});

export const StoreNewsletterConfirm = StoreNewsletterToken.extend({
  first_name: z.string().trim().min(1).max(100),
});

export type StoreNewsletterConfirmType = z.infer<typeof StoreNewsletterConfirm>;

export const AdminNewsletterSubscribersQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).max(1_000_000).default(0),
  status: z.enum(["pending", "subscribed", "unsubscribed"]).optional(),
});

export type StoreNewsletterTokenType = z.infer<typeof StoreNewsletterToken>;

/** The token from a cart reminder email's links (48 hex characters). */
export const StoreCartReminderToken = z.object({
  token: z.string().regex(/^[0-9a-f]{48}$/, "This link is not valid."),
});

export type StoreCartReminderTokenType = z.infer<typeof StoreCartReminderToken>;

/**
 * Hours after the cart's last change. Clearing a later delay turns that
 * reminder off; their order is checked on save against the stored values.
 */
export const AdminUpdateCartReminderSettings = z.object({
  enabled: z.boolean().optional(),
  first_delay_hours: z.number().int().min(1).max(168).optional(),
  second_delay_hours: z.number().int().min(2).max(720).nullable().optional(),
  third_delay_hours: z.number().int().min(3).max(2160).nullable().optional(),
});

export type AdminUpdateCartReminderSettingsType = z.infer<
  typeof AdminUpdateCartReminderSettings
>;

export const StoreSetCustomerPassword = z.object({
  password: z.string().min(8),
});

export type StoreSetCustomerPasswordType = z.infer<
  typeof StoreSetCustomerPassword
>;

export const StoreCreateSocialCustomer = z.object({
  first_name: z.string().min(1).nullable().optional(),
  last_name: z.string().min(1).nullable().optional(),
});

export type StoreCreateSocialCustomerType = z.infer<
  typeof StoreCreateSocialCustomer
>;

export const StoreAddWishlistItem = z.object({
  product_id: z.string().min(1),
  /** Set when a specific colour/size was chosen on the product page. */
  variant_id: z.string().min(1).nullable().optional(),
});

export type StoreAddWishlistItemType = z.infer<typeof StoreAddWishlistItem>;

export const StoreMergeWishlist = z.object({
  /** The guest wishlist to fold into the signed-in customer's list. */
  wishlist_id: z.string().min(1),
});

export type StoreMergeWishlistType = z.infer<typeof StoreMergeWishlist>;

export const StoreCreateProductAlert = z.object({
  /** Required for guests; ignored when signed in (the account email is used). */
  email: z.email().optional(),
  /** Set when a specific size/colour was chosen; omit to wait on any. */
  variant_id: z.string().min(1).nullable().optional(),
  /** Also sign the address up for the newsletter (double opt-in applies). */
  marketing_opt_in: z.boolean().optional(),
});

export type StoreCreateProductAlertType = z.infer<
  typeof StoreCreateProductAlert
>;

export const StoreSetMarketingPreference = z.object({
  subscribed: z.boolean(),
});

export type StoreSetMarketingPreferenceType = z.infer<
  typeof StoreSetMarketingPreference
>;

export const AdminSetProductComingSoon = z.object({
  coming_soon: z.boolean(),
});

export type AdminSetProductComingSoonType = z.infer<
  typeof AdminSetProductComingSoon
>;

/**
 * A size guide's table. Structure only: whether cells match their column's
 * type and whether sizes exist is checked in the workflow, where the messages
 * can name the column and size.
 */
export const SizeGuideTable = z.object({
  columns: z
    .array(
      z.object({
        key: z
          .string()
          .regex(/^[a-z][a-z0-9_]*$/, "Column keys use a-z, 0-9 and _.")
          .max(32),
        label: z.string().trim().min(1).max(40),
        type: z.enum(["measurement", "text"]),
      }),
    )
    .min(1)
    .max(12),
  rows: z
    .array(
      z.object({
        size: z.string().trim().min(1).max(20),
        values: z.record(
          z.string(),
          z.union([
            // Centimetres. 500 is far past any body or garment measurement.
            z.number().positive().max(500),
            z.tuple([
              z.number().positive().max(500),
              z.number().positive().max(500),
            ]),
            z.string().trim().max(40),
            z.null(),
          ]),
        ),
      }),
    )
    .min(1)
    .max(40),
});

export const AdminCreateSizeGuide = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().trim().max(2000).nullable().optional(),
  diagram_url: z.url().nullable().optional(),
  table: SizeGuideTable,
  is_default: z.boolean().optional(),
});

export type AdminCreateSizeGuideType = z.infer<typeof AdminCreateSizeGuide>;

export const AdminUpdateSizeGuide = AdminCreateSizeGuide.partial();

export type AdminUpdateSizeGuideType = z.infer<typeof AdminUpdateSizeGuide>;

export const AdminSetSizeGuide = z.object({
  /** null removes the guide, so the product or category inherits again. */
  size_guide_id: z.string().min(1).nullable(),
});

export type AdminSetSizeGuideType = z.infer<typeof AdminSetSizeGuide>;

/** The store's social profiles, used in structured data and the site footer. */
export const SocialLinks = z.object({
  instagram: z.url().nullable().optional(),
  facebook: z.url().nullable().optional(),
  tiktok: z.url().nullable().optional(),
  x: z.url().nullable().optional(),
  youtube: z.url().nullable().optional(),
  pinterest: z.url().nullable().optional(),
});

export type SocialLinksType = z.infer<typeof SocialLinks>;

/** A path on the storefront ("/new-arrivals") or a full http(s) address. */
const LinkDestination = z
  .string()
  .trim()
  .max(2048)
  .refine(
    (value) =>
      (value.startsWith("/") && !value.startsWith("//")) ||
      /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(value),
    'Use a page on the store starting with "/", like /new-arrivals, or a full https:// address.',
  );

const optionalText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

/**
 * The whole hero, replacing what is stored: a field left out is cleared. Text
 * can be saved while the hero is off, so staff can prepare it before turning
 * it on; turning it on needs a headline and a desktop image, and a button
 * needs both its label and destination. A desktop video makes the hero a
 * video, with the images kept as its posters, so the image stays required.
 */
export const HomepageHero = z
  .object({
    enabled: z.boolean(),
    eyebrow: optionalText(40),
    title: optionalText(120),
    description: optionalText(300),
    desktop_image_url: z.url().nullable().optional(),
    mobile_image_url: z.url().nullable().optional(),
    desktop_video_url: z.url().nullable().optional(),
    mobile_video_url: z.url().nullable().optional(),
    cta_label: optionalText(40),
    cta_url: LinkDestination.nullable().optional(),
  })
  .superRefine((hero, ctx) => {
    if (hero.mobile_video_url && !hero.desktop_video_url) {
      ctx.addIssue({
        code: "custom",
        path: ["mobile_video_url"],
        message:
          "Add a desktop video first. A mobile video only replaces it on phones.",
      });
    }

    if (Boolean(hero.cta_label) !== Boolean(hero.cta_url)) {
      ctx.addIssue({
        code: "custom",
        path: [hero.cta_label ? "cta_url" : "cta_label"],
        message: "A button needs both a label and a destination.",
      });
    }

    if (!hero.enabled) {
      return;
    }

    if (!hero.title) {
      ctx.addIssue({
        code: "custom",
        path: ["title"],
        message: "Add a headline before turning the hero on.",
      });
    }

    if (!hero.desktop_image_url) {
      ctx.addIssue({
        code: "custom",
        path: ["desktop_image_url"],
        message: hero.desktop_video_url
          ? "Add a desktop image before turning the hero on. It shows while the video loads or can't play."
          : "Add a desktop image before turning the hero on.",
      });
    }
  });

export type HomepageHeroType = z.infer<typeof HomepageHero>;

const StoreMenuPromo = z.object({
  target_type: z.enum(["collection", "category", "product"]),
  target_id: z.string().trim().min(1),
  image_url: z.url(),
  mobile_image_url: z.url().nullable().optional(),
});

export type StoreMenuPromoType = z.infer<typeof StoreMenuPromo>;

export const AdminUpdateStorefrontSettings = z.object({
  /** Whole days, from 1 to a year. */
  new_badge_days: z.number().int().min(1).max(365).optional(),
  /** The home page title, and the fallback for pages without their own. */
  seo_title: z.string().trim().max(70).nullable().optional(),
  /** Search engines show about 155 characters; longer text is cut off. */
  seo_description: z.string().trim().max(200).nullable().optional(),
  /** The default link preview image; 1200 x 630 works everywhere. */
  og_image_url: z.url().nullable().optional(),
  twitter_handle: z
    .string()
    .trim()
    .regex(/^@?[A-Za-z0-9_]{1,15}$/, "Use the X username, like @youjaymharah.")
    .nullable()
    .optional(),
  social_links: SocialLinks.optional(),
  /** Off asks search engines not to index the store (staging, pre-launch). */
  allow_indexing: z.boolean().optional(),
  /** The `content` value of Google Search Console's HTML tag. */
  google_site_verification: z
    .string()
    .trim()
    .regex(
      /^[A-Za-z0-9_-]{1,100}$/,
      "Paste only the code from the tag's content value.",
    )
    .nullable()
    .optional(),
  homepage_hero: HomepageHero.optional(),
  /** The collection featured on the home page; null features none. */
  featured_collection_id: z.string().trim().min(1).nullable().optional(),
  /** Up to two curated cards in the Store megamenu (not commerce discounts). */
  store_menu_cards: z.array(StoreMenuPromo).max(2).optional(),
  announcement_bar: AnnouncementBar.optional(),
});

export type AdminUpdateStorefrontSettingsType = z.infer<
  typeof AdminUpdateStorefrontSettings
>;

/**
 * A repeatable query parameter: Express hands over a string for one
 * occurrence and an array for several, so both are normalized to an array.
 */
const repeatable = z
  .union([z.string(), z.array(z.string())])
  .transform((value) => (Array.isArray(value) ? value : [value]))
  .optional();

export const StoreSearchProducts = z.object({
  q: z.string().trim().min(1).max(128).optional(),
  limit: z.coerce.number().int().min(1).max(50).default(24),
  offset: z.coerce.number().int().min(0).default(0),
  category: repeatable,
  type: repeatable,
  collection: repeatable,
  tag: repeatable,
});

export type StoreSearchProductsType = z.infer<typeof StoreSearchProducts>;

export const StoreSearchSuggestions = z.object({
  q: z.string().trim().min(2).max(64),
  limit: z.coerce.number().int().min(1).max(10).default(6),
});

export type StoreSearchSuggestionsType = z.infer<typeof StoreSearchSuggestions>;

export const StoreSearchTrending = z.object({
  limit: z.coerce.number().int().min(1).max(10).default(6),
});

export type StoreSearchTrendingType = z.infer<typeof StoreSearchTrending>;

export default defineMiddlewares({
  // Reports 5xx responses to Sentry, then answers exactly as Medusa would.
  errorHandler: (error, req, res, next) => {
    reportRequestError(error, req);
    return defaultErrorHandler()(error, req, res, next);
  },
  routes: [
    {
      matcher: "/admin/search-vocabulary",
      method: ["GET"],
      policies: [{ resource: "storefront_settings", operation: "read" }],
    },
    {
      matcher: "/admin/search-vocabulary",
      method: ["POST"],
      middlewares: [validateAndTransformBody(UpdateSearchVocabulary)],
      policies: [{ resource: "storefront_settings", operation: "update" }],
    },
    {
      matcher: "/admin/search-fallback-terms",
      method: ["GET"],
      policies: [{ resource: "storefront_settings", operation: "read" }],
    },
    {
      matcher: "/admin/search-fallback-terms",
      method: ["POST"],
      middlewares: [validateAndTransformBody(UpdateSearchFallbackTerms)],
      policies: [{ resource: "storefront_settings", operation: "update" }],
    },
    {
      matcher: "/webhooks/resend",
      method: ["POST"],
      bodyParser: { preserveRawBody: true, sizeLimit: "64kb" },
    },
    {
      matcher: "/store/newsletter/subscribe",
      method: ["POST"],
      middlewares: [rateLimit("newsletter-signup", 5)],
    },
    {
      matcher: "/store/newsletter/confirm",
      method: ["POST"],
      middlewares: [rateLimit("newsletter-token", 30)],
    },
    {
      matcher: "/store/newsletter/unsubscribe",
      method: ["POST"],
      middlewares: [rateLimit("newsletter-token", 30)],
    },
    {
      matcher: "/store/products/:id/alerts",
      method: ["POST"],
      middlewares: [rateLimit("product-alert", 10)],
    },
    {
      matcher: "/store/cart-reminders/*",
      method: ["POST"],
      middlewares: [rateLimit("cart-reminder", 30)],
    },
    {
      matcher: "/store/search",
      method: ["GET"],
      middlewares: [rateLimit("search", 120)],
    },
    {
      matcher: "/store/search/*",
      method: ["GET"],
      middlewares: [rateLimit("search", 120)],
    },
    {
      matcher: "/admin/newsletter/subscribers",
      method: ["GET"],
      middlewares: [
        validateAndTransformQuery<BaseEntity>(AdminNewsletterSubscribersQuery, {
          isList: true,
          defaultLimit: 50,
        }),
      ],
    },
    // Custom admin routes are ungated unless they declare policies -- without
    // these entries any authenticated admin user could read and rewrite these
    // settings regardless of their role.
    {
      matcher: "/admin/branding",
      method: ["GET"],
      policies: [{ resource: "branding", operation: "read" }],
    },
    {
      matcher: "/admin/branding",
      method: ["POST"],
      middlewares: [validateAndTransformBody(AdminUpdateBranding)],
      policies: [{ resource: "branding", operation: "update" }],
    },
    {
      matcher: "/admin/newsletter/*",
      method: ["GET"],
      policies: [{ resource: "newsletter", operation: "read" }],
    },
    {
      matcher: "/admin/newsletter/settings",
      method: ["POST"],
      middlewares: [validateAndTransformBody(AdminUpdateNewsletterSettings)],
      policies: [{ resource: "newsletter", operation: "update" }],
    },
    // Store routes are public; validation is the only gate, and the handlers
    // deliberately return the same response whether or not an address is known.
    {
      matcher: "/store/newsletter/subscribe",
      method: ["POST"],
      middlewares: [validateAndTransformBody(StoreNewsletterSubscribe)],
    },
    {
      matcher: "/store/newsletter/confirm",
      method: ["POST"],
      middlewares: [validateAndTransformBody(StoreNewsletterConfirm)],
    },
    {
      matcher: "/store/newsletter/unsubscribe",
      method: ["POST"],
      middlewares: [validateAndTransformBody(StoreNewsletterToken)],
    },
    // Cart reminder links are public: the emailed token is the credential.
    {
      matcher: "/store/cart-reminders/restore",
      method: ["POST"],
      middlewares: [validateAndTransformBody(StoreCartReminderToken)],
    },
    {
      matcher: "/store/cart-reminders/stop",
      method: ["POST"],
      middlewares: [validateAndTransformBody(StoreCartReminderToken)],
    },
    {
      matcher: "/admin/cart-reminders/settings",
      method: ["GET"],
      policies: [{ resource: "cart_reminder", operation: "read" }],
    },
    {
      matcher: "/admin/cart-reminders/settings",
      method: ["POST"],
      middlewares: [validateAndTransformBody(AdminUpdateCartReminderSettings)],
      policies: [{ resource: "cart_reminder", operation: "update" }],
    },
    {
      matcher: "/admin/cart-reminders/stats",
      method: ["GET"],
      policies: [{ resource: "cart_reminder", operation: "read" }],
    },
    // Finishing a social sign-in: the caller holds a token for an auth
    // identity that may not have a customer yet, so `allowUnregistered`
    // mirrors how Medusa gates its own POST /store/customers.
    {
      matcher: "/store/customers/social",
      method: ["POST"],
      middlewares: [
        authenticate("customer", ["session", "bearer"], {
          allowUnregistered: true,
        }),
        validateAndTransformBody(StoreCreateSocialCustomer),
      ],
    },
    // Also under /store/customers/me, so a logged-in customer is guaranteed;
    // the email comes from their account, never from the body.
    {
      matcher: "/store/customers/me/password",
      method: ["POST"],
      middlewares: [validateAndTransformBody(StoreSetCustomerPassword)],
    },
    // Wishlist routes live under /store/customers/me, which Medusa already
    // restricts to logged-in customers; only the body needs validating.
    {
      matcher: "/store/customers/me/wishlist/items",
      method: ["POST"],
      middlewares: [validateAndTransformBody(StoreAddWishlistItem)],
    },
    {
      matcher: "/store/customers/me/wishlist/merge",
      method: ["POST"],
      middlewares: [validateAndTransformBody(StoreMergeWishlist)],
    },
    // Guest wishlists are public, like guest carts: the wishlist ID is the
    // credential, and the workflows refuse any list that belongs to a customer.
    {
      matcher: "/store/wishlists",
      method: ["POST"],
      middlewares: [validateAndTransformBody(StoreAddWishlistItem)],
    },
    {
      matcher: "/store/wishlists/:id/items",
      method: ["POST"],
      middlewares: [validateAndTransformBody(StoreAddWishlistItem)],
    },
    // Guests and customers share one route: a valid customer token means the
    // account email is used, and no token means the body must carry one.
    {
      matcher: "/store/products/:id/alerts",
      method: ["POST"],
      middlewares: [
        authenticate("customer", ["session", "bearer"], {
          allowUnauthenticated: true,
        }),
        validateAndTransformBody(StoreCreateProductAlert),
      ],
    },
    {
      matcher: "/store/customers/me/marketing",
      method: ["POST"],
      middlewares: [validateAndTransformBody(StoreSetMarketingPreference)],
    },
    // Built-in product permissions, so whoever may edit a product may also
    // launch it, and whoever may view it sees who is waiting.
    {
      matcher: "/admin/products/:id/alerts",
      method: ["GET"],
      policies: [{ resource: "product", operation: "read" }],
    },
    {
      matcher: "/admin/products/:id/coming-soon",
      method: ["POST"],
      middlewares: [validateAndTransformBody(AdminSetProductComingSoon)],
      policies: [{ resource: "product", operation: "update" }],
    },
    // Size guides have their own permission (src/policies/size-guide.ts);
    // assigning one to a product or category needs edit rights on that
    // product or category instead.
    {
      matcher: "/admin/size-guides",
      method: ["GET"],
      policies: [{ resource: "size_guide", operation: "read" }],
    },
    {
      matcher: "/admin/size-guides",
      method: ["POST"],
      middlewares: [validateAndTransformBody(AdminCreateSizeGuide)],
      policies: [{ resource: "size_guide", operation: "create" }],
    },
    {
      matcher: "/admin/size-guides/:id",
      method: ["GET"],
      policies: [{ resource: "size_guide", operation: "read" }],
    },
    {
      matcher: "/admin/size-guides/:id",
      method: ["POST"],
      middlewares: [validateAndTransformBody(AdminUpdateSizeGuide)],
      policies: [{ resource: "size_guide", operation: "update" }],
    },
    {
      matcher: "/admin/size-guides/:id",
      method: ["DELETE"],
      policies: [{ resource: "size_guide", operation: "delete" }],
    },
    {
      matcher: "/admin/products/:id/size-guide",
      method: ["GET"],
      policies: [{ resource: "product", operation: "read" }],
    },
    {
      matcher: "/admin/products/:id/size-guide",
      method: ["POST"],
      middlewares: [validateAndTransformBody(AdminSetSizeGuide)],
      policies: [{ resource: "product", operation: "update" }],
    },
    {
      matcher: "/admin/product-categories/:id/size-guide",
      method: ["GET"],
      policies: [{ resource: "product_category", operation: "read" }],
    },
    {
      matcher: "/admin/product-categories/:id/size-guide",
      method: ["POST"],
      middlewares: [validateAndTransformBody(AdminSetSizeGuide)],
      policies: [{ resource: "product_category", operation: "update" }],
    },
    {
      matcher: "/admin/storefront-settings",
      method: ["GET"],
      policies: [{ resource: "storefront_settings", operation: "read" }],
    },
    {
      matcher: "/admin/storefront-settings",
      method: ["POST"],
      middlewares: [validateAndTransformBody(AdminUpdateStorefrontSettings)],
      policies: [{ resource: "storefront_settings", operation: "update" }],
    },
    {
      matcher: "/admin/storefront-settings/hero-history",
      method: ["GET"],
      policies: [{ resource: "storefront_settings", operation: "read" }],
    },
    {
      matcher: "/admin/storefront-settings/announcement-options",
      method: ["GET"],
      middlewares: [
        validateAndTransformQuery<BaseEntity>(AnnouncementOptionsQuery, {}),
      ],
      policies: [{ resource: "storefront_settings", operation: "read" }],
    },
    {
      matcher: "/admin/storefront-settings/hero-history/:id/restore",
      method: ["POST"],
      policies: [{ resource: "storefront_settings", operation: "update" }],
    },
    // Search reads its arguments from the query string, so the schema gates
    // the paging limits as well -- an unbounded `limit` would let one request
    // pull the whole index.
    {
      matcher: "/store/search",
      method: ["GET"],
      middlewares: [
        // The type argument is not optional in practice: the helper's `TEntity`
        // is not referenced by either parameter, so nothing infers it, and the
        // call's return type degrades to one that no longer satisfies
        // `MiddlewareRoute["middlewares"]`. TypeScript then re-infers the whole
        // `routes` array against a different shape and reports the *other*
        // entries' `policies` as unknown properties -- errors nowhere near the
        // real cause. There is no entity behind this route, so the base type is
        // the honest argument.
        validateAndTransformQuery<BaseEntity>(StoreSearchProducts, {
          isList: true,
          defaultLimit: 24,
        }),
      ],
    },
    {
      matcher: "/store/search/trending",
      method: ["GET"],
      middlewares: [
        validateAndTransformQuery<BaseEntity>(StoreSearchTrending, {
          isList: true,
          defaultLimit: 6,
        }),
      ],
    },
    {
      matcher: "/store/search/suggestions",
      method: ["GET"],
      middlewares: [
        validateAndTransformQuery<BaseEntity>(StoreSearchSuggestions, {
          isList: true,
          defaultLimit: 6,
        }),
      ],
    },
  ],
});
