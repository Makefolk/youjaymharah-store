import {
  authenticate,
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery,
  type MedusaRequest,
  type MedusaResponse,
} from "@medusajs/framework/http";
import type { BaseEntity } from "@medusajs/framework/types";
import { z } from "@medusajs/framework/zod";
import { errorHandler as defaultErrorHandler } from "@medusajs/framework/http";

import { rateLimit } from "./rate-limit";
import { requireOrderAccess } from "./order-access";
import { enforcePasswordPolicy } from "./password-policy";
import { refuseEndedSessions } from "./session-revocation";
import {
  restrictNotifications,
  requireWorkflowAdministrator,
} from "./private-admin-data";
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
  password: z.string().min(8).max(128),
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

export const StoreCatalogQuery = z.object({
  /** A search term; narrows the listing to matches, in relevance order. */
  q: z.string().trim().min(1).max(128).optional(),
  category: z.string().trim().min(1).max(200).optional(),
  collection: z.string().trim().min(1).max(200).optional(),
  region_id: z.string().min(1),
  sort: z
    .enum(["recommended", "newest", "price_asc", "price_desc"])
    .default("recommended"),
  offset: z.coerce.number().int().min(0).max(10_000).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(24),
  type: repeatable,
  colour: repeatable,
  size: repeatable,
  material: repeatable,
  fit: repeatable,
  feature: repeatable,
});

export type StoreCatalogQueryType = z.infer<typeof StoreCatalogQuery>;

/** Blank clears a field, so the contact page leaves it out. */
const clearableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((value) => value || null)
    .nullable()
    .optional();

/** International form, as tel: and wa.me links need: +2348012345678. */
const phoneNumber = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s()-]/g, ""))
  .pipe(
    z
      .string()
      .regex(
        /^(\+[1-9]\d{6,14})?$/,
        "Use the international form, starting with +, like +2348012345678.",
      ),
  )
  .transform((value) => value || null)
  .nullable()
  .optional();

/** Blank clears a page, which also takes it out of the footer. */
const pageText = z
  .string()
  .max(30000)
  .transform((value) => (value.trim() ? value.trim() : null))
  .nullable()
  .optional();

export const AdminUpdateContentPages = z.object({
  about: pageText,
  privacy: pageText,
  terms: pageText,
});

export type AdminUpdateContentPagesType = z.infer<
  typeof AdminUpdateContentPages
>;

export const AdminUpdateSupportInfo = z.object({
  hours: clearableText(120),
  response_time: clearableText(80),
  phone: phoneNumber,
  whatsapp: phoneNumber,
  delivery_information: clearableText(2000),
});

export type AdminUpdateSupportInfoType = z.infer<typeof AdminUpdateSupportInfo>;

export const AdminUpdateReturnPolicy = z.object({
  enabled: z.boolean().optional(),
  /** Days after delivery; a year at most. */
  window_days: z.number().int().min(1).max(365).optional(),
});

export type AdminUpdateReturnPolicyType = z.infer<
  typeof AdminUpdateReturnPolicy
>;

export const AdminResendShippingEmail = z.object({
  fulfillment_id: z.string().min(1),
});

export type AdminResendShippingEmailType = z.infer<
  typeof AdminResendShippingEmail
>;

export const CONTACT_TOPICS = [
  "An order",
  "Delivery",
  "A return or refund",
  "A product or sizing",
  "Something else",
] as const;

export const StoreContactMessage = z.object({
  name: z.string().trim().min(1).max(100),
  email: z.email(),
  topic: z.enum(CONTACT_TOPICS).nullable().optional(),
  /** "#1042" or "1042". */
  order_number: z
    .string()
    .trim()
    .transform((value) => value.replace(/^#/, ""))
    .pipe(
      z.string().regex(/^\d{0,10}$/, "Enter the number from your order email."),
    )
    .transform((value) => value || null)
    .nullable()
    .optional(),
  message: z.string().trim().min(10).max(4000),
  /** Hidden from people; anything here marks the sender as a bot. */
  website: z.string().max(200).optional(),
});

export type StoreContactMessageType = z.infer<typeof StoreContactMessage>;

export const StoreChangePassword = z.object({
  current_password: z.string().min(1).max(128),
  /** The storefront's own minimum; Medusa accepts any. */
  new_password: z.string().min(8).max(128),
});

export type StoreChangePasswordType = z.infer<typeof StoreChangePassword>;

const SupportPhoto = z.object({
  name: z.string().trim().min(1).max(120),
  /** Base64; checked by its bytes on the server. */
  data: z.string().min(1).max(4_300_000),
});

export const ORDER_HELP_KINDS = [
  "order",
  "cancel",
  "change_address",
  "exchange",
  "damaged",
  "missing",
] as const;

export const StoreOrderHelp = z.object({
  kind: z.enum(ORDER_HELP_KINDS),
  message: z.string().trim().min(10).max(4000),
  photos: z.array(SupportPhoto).max(3).optional(),
});

export type StoreOrderHelpType = z.infer<typeof StoreOrderHelp>;

export const StoreSupportAccess = z.object({
  /** The key from the request's email link; not needed when signed in. */
  access: z.string().max(200).optional(),
});

export type StoreSupportAccessType = z.infer<typeof StoreSupportAccess>;

export const StoreSupportReply = StoreSupportAccess.extend({
  body: z.string().trim().min(1).max(4000),
  photos: z.array(SupportPhoto).max(3).optional(),
});

export type StoreSupportReplyType = z.infer<typeof StoreSupportReply>;

export const AdminSupportRequestsQuery = z.object({
  status: z.enum(["open", "awaiting_customer", "resolved"]).optional(),
  /** "me" for the caller's own. */
  assigned_to: z.string().optional(),
  q: z.string().trim().max(100).optional(),
  offset: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type AdminSupportRequestsQueryType = z.infer<
  typeof AdminSupportRequestsQuery
>;

export const AdminUpdateSupportRequest = z.object({
  status: z.enum(["open", "awaiting_customer", "resolved"]).optional(),
  priority: z.enum(["normal", "high"]).optional(),
  assigned_to: z.string().min(1).nullable().optional(),
});

export type AdminUpdateSupportRequestType = z.infer<
  typeof AdminUpdateSupportRequest
>;

export const AdminSupportReply = z.object({
  body: z.string().trim().min(1).max(8000),
  /** A note for staff only; the customer isn't told. */
  internal: z.boolean().default(false),
});

export type AdminSupportReplyType = z.infer<typeof AdminSupportReply>;

export const StoreVerifyCustomerEmail = z.object({
  token: z.string().trim().min(1).max(512),
});

export type StoreVerifyCustomerEmailType = z.infer<
  typeof StoreVerifyCustomerEmail
>;

export const AdminRecordCredoRefund = z.object({
  payment_id: z.string().min(1),
  /** In naira, as the admin shows amounts. */
  amount: z.number().positive(),
  /** The refund's reference in the Credo dashboard. */
  reference: z.string().trim().min(3).max(100),
  refund_reason_id: z.string().min(1).nullable().optional(),
  note: z.string().trim().max(500).nullable().optional(),
});

export type AdminRecordCredoRefundType = z.infer<typeof AdminRecordCredoRefund>;
export const AdminRecordPaystackRefund = AdminRecordCredoRefund.extend({
  reference: z
    .string()
    .regex(/^[1-9]\d{0,19}$/, "Use the numeric Paystack refund ID."),
});
export type AdminRecordPaystackRefundType = z.infer<
  typeof AdminRecordPaystackRefund
>;

export const AdminResolveEmailDelivery = z.discriminatedUnion("resolution", [
  z.object({
    resolution: z.literal("sent"),
    /** The email's ID in Resend's dashboard, as evidence it was accepted. */
    provider_id: z.uuid("Paste the email's ID from Resend, like 4ef9a417-…"),
    note: z.string().trim().max(500).nullable().optional(),
  }),
  z.object({
    resolution: z.literal("not_sent"),
    note: z.string().trim().max(500).nullable().optional(),
  }),
]);

export type AdminResolveEmailDeliveryType = z.infer<
  typeof AdminResolveEmailDelivery
>;

export const StoreOrderLookup = z.object({
  email: z.email(),
  /** The order number on the confirmation, with or without its "#". */
  display_id: z.coerce.number().int().positive(),
});

export type StoreOrderLookupType = z.infer<typeof StoreOrderLookup>;

export const StoreRequestReturn = z.object({
  items: z
    .array(
      z.object({
        id: z.string().min(1),
        quantity: z.number().int().min(1),
        reason_id: z.string().min(1).nullable().optional(),
      }),
    )
    .min(1)
    .max(50),
  note: z.string().trim().max(1000).nullable().optional(),
  /**
   * Required for guests: the token from the emailed return link, as proof
   * they can read the order's inbox.
   */
  access: z.string().trim().min(1).max(200).nullable().optional(),
});

export type StoreRequestReturnType = z.infer<typeof StoreRequestReturn>;

export const AdminPaymentLookup = z
  .object({
    /** From the customer's receipt or bank alert. */
    reference: z.string().trim().min(1).max(200).optional(),
    email: z.email().optional(),
  })
  .refine((query) => Boolean(query.reference) !== Boolean(query.email), {
    message: "Search by either a payment reference or an email.",
  });

export type AdminPaymentLookupType = z.infer<typeof AdminPaymentLookup>;

export const AdminCreateOrderFromPayment = z.object({
  session_id: z.string().regex(/^payses_/, "Not a payment session id."),
});

export type AdminCreateOrderFromPaymentType = z.infer<
  typeof AdminCreateOrderFromPayment
>;

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
      matcher: "/admin/orders/:id/paystack-refunds",
      method: ["POST"],
      middlewares: [validateAndTransformBody(AdminRecordPaystackRefund)],
      policies: [{ resource: "refund", operation: "create" }],
    },
    {
      matcher: "/auth/*",
      bodyParser: { sizeLimit: "16kb" },
      middlewares: [rateLimit("auth-ip", 60)],
    },
    // No method, so these run before every route's own middlewares.
    { matcher: "/store/*", middlewares: [refuseEndedSessions] },
    { matcher: "/admin/*", middlewares: [refuseEndedSessions] },
    { matcher: "/auth/token/refresh", middlewares: [refuseEndedSessions] },
    { matcher: "/auth/session", middlewares: [refuseEndedSessions] },
    {
      matcher: "/auth/:actor_type/emailpass",
      method: ["POST"],
      middlewares: [rateLimit("password-login", 10, "account")],
    },
    {
      matcher: "/auth/:actor_type/emailpass/register",
      method: ["POST"],
      middlewares: [rateLimit("registration", 10), enforcePasswordPolicy],
    },
    {
      matcher: "/auth/:actor_type/emailpass/update",
      method: ["POST"],
      middlewares: [rateLimit("password-update", 10), enforcePasswordPolicy],
    },
    {
      matcher: "/auth/:actor_type/:auth_provider/reset-password",
      method: ["POST"],
      middlewares: [
        rateLimit("password-reset-ip", 10),
        rateLimit("password-reset-account", 3, "account"),
      ],
    },
    {
      matcher: "/store/wishlists*",
      method: ["POST", "DELETE"],
      middlewares: [rateLimit("guest-wishlist", 30)],
    },
    {
      matcher: "/admin/notifications",
      method: ["GET"],
      middlewares: [restrictNotifications],
    },
    {
      matcher: "/admin/notifications/:id",
      method: ["GET"],
      middlewares: [restrictNotifications],
    },
    {
      matcher: "/admin/workflows-executions",
      middlewares: [requireWorkflowAdministrator],
    },
    {
      matcher: "/admin/workflows-executions/*",
      middlewares: [requireWorkflowAdministrator],
    },
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
      matcher: "/store/catalog",
      method: ["GET"],
      middlewares: [
        rateLimit("catalog", 240),
        validateAndTransformQuery<BaseEntity>(StoreCatalogQuery, {}),
      ],
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
    {
      // As Medusa's own refund route: whoever may refund may record one.
      matcher: "/admin/orders/:id/credo-refunds",
      method: ["POST"],
      middlewares: [validateAndTransformBody(AdminRecordCredoRefund)],
      policies: [{ resource: "refund", operation: "create" }],
    },
    {
      matcher: "/admin/attention",
      method: ["GET"],
      policies: [{ resource: "order", operation: "read" }],
    },
    {
      matcher: "/admin/email-review",
      method: ["GET"],
      policies: [{ resource: "order", operation: "read" }],
    },
    {
      matcher: "/admin/email-review/:id/resolve",
      method: ["POST"],
      middlewares: [validateAndTransformBody(AdminResolveEmailDelivery)],
      policies: [{ resource: "order", operation: "update" }],
    },
    {
      matcher: "/admin/payment-lookup",
      method: ["GET"],
      middlewares: [
        validateAndTransformQuery<BaseEntity>(AdminPaymentLookup, {}),
      ],
      policies: [{ resource: "order", operation: "read" }],
    },
    {
      matcher: "/admin/payment-lookup/create-order",
      method: ["POST"],
      middlewares: [validateAndTransformBody(AdminCreateOrderFromPayment)],
      policies: [{ resource: "order", operation: "create" }],
    },
    {
      matcher: "/admin/content-pages",
      method: ["GET"],
      policies: [{ resource: "storefront_settings", operation: "read" }],
    },
    {
      matcher: "/admin/content-pages",
      method: ["POST"],
      middlewares: [validateAndTransformBody(AdminUpdateContentPages)],
      policies: [{ resource: "storefront_settings", operation: "update" }],
    },
    {
      matcher: "/admin/support-info",
      method: ["GET"],
      policies: [{ resource: "support_info", operation: "read" }],
    },
    {
      matcher: "/admin/support-info",
      method: ["POST"],
      middlewares: [validateAndTransformBody(AdminUpdateSupportInfo)],
      policies: [{ resource: "support_info", operation: "update" }],
    },
    {
      matcher: "/admin/return-policy",
      method: ["GET"],
      policies: [{ resource: "return_policy", operation: "read" }],
    },
    {
      matcher: "/admin/return-policy",
      method: ["POST"],
      middlewares: [validateAndTransformBody(AdminUpdateReturnPolicy)],
      policies: [{ resource: "return_policy", operation: "update" }],
    },
    {
      matcher: "/store/order-lookup",
      method: ["POST"],
      middlewares: [
        rateLimit("order-lookup", 10),
        // Each match emails the customer, so cap it per address too.
        rateLimit("order-lookup-email", 3, "account"),
        validateAndTransformBody(StoreOrderLookup),
      ],
    },
    // An order ID alone opens nothing: the signed-in owner, or a key from
    // an order link (src/api/order-access.ts).
    {
      matcher: "/store/orders/:id",
      method: ["GET"],
      middlewares: [requireOrderAccess],
    },
    {
      matcher: "/store/orders/:id/return-options",
      method: ["GET"],
      middlewares: [requireOrderAccess],
    },
    {
      matcher: "/store/carts/:id/order-access",
      method: ["GET"],
      middlewares: [rateLimit("order-access", 30)],
    },
    {
      // Medusa's own return route takes any order ID without checking who is
      // asking, ignores the store's return policy, and lets the caller mark
      // the return received (receive_now). Customers request returns through
      // /store/orders/:id/return-requests instead.
      matcher: "/store/returns",
      method: ["POST"],
      middlewares: [
        (_req: MedusaRequest, res: MedusaResponse) => {
          res.status(404).json({
            type: "not_found",
            message:
              "Request a return with POST /store/orders/{id}/return-requests.",
          });
        },
      ],
    },
    {
      // Each call sends an email to the order's address.
      matcher: "/store/orders/:id/return-access",
      method: ["POST"],
      middlewares: [rateLimit("return-access", 5)],
    },
    {
      matcher: "/store/orders/:id/return-requests",
      method: ["POST"],
      middlewares: [
        rateLimit("return-request", 10),
        authenticate("customer", ["session", "bearer"], {
          allowUnauthenticated: true,
        }),
        validateAndTransformBody(StoreRequestReturn),
      ],
    },
    {
      matcher: "/admin/orders/:id/emails",
      method: ["GET"],
      policies: [{ resource: "order", operation: "read" }],
    },
    {
      matcher: "/admin/orders/:id/emails/resend-confirmation",
      method: ["POST"],
      policies: [{ resource: "order", operation: "update" }],
    },
    {
      matcher: "/admin/orders/:id/emails/resend-shipping",
      method: ["POST"],
      policies: [{ resource: "order", operation: "update" }],
      middlewares: [validateAndTransformBody(AdminResendShippingEmail)],
    },
    {
      matcher: "/admin/customers/:id/support-context",
      method: ["GET"],
      policies: [{ resource: "customer", operation: "read" }],
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
    {
      // Each message sends two emails. Signed in, the request also shows in
      // the account.
      matcher: "/store/contact",
      method: ["POST"],
      middlewares: [
        rateLimit("contact", 5),
        authenticate("customer", ["session", "bearer"], {
          allowUnauthenticated: true,
        }),
        validateAndTransformBody(StoreContactMessage),
      ],
    },
    {
      matcher: "/store/orders/:id/help",
      method: ["POST"],
      // Photos arrive as base64 in the body.
      bodyParser: { sizeLimit: "15mb" },
      middlewares: [
        rateLimit("order-help", 5),
        requireOrderAccess,
        validateAndTransformBody(StoreOrderHelp),
      ],
    },
    {
      matcher: "/store/support-requests",
      method: ["GET"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/support-requests/:id",
      method: ["GET"],
      middlewares: [
        rateLimit("support-read", 60),
        authenticate("customer", ["session", "bearer"], {
          allowUnauthenticated: true,
        }),
        validateAndTransformQuery<BaseEntity>(StoreSupportAccess, {}),
      ],
    },
    {
      matcher: "/store/support-requests/:id/messages",
      method: ["POST"],
      bodyParser: { sizeLimit: "15mb" },
      middlewares: [
        rateLimit("support-reply", 10),
        authenticate("customer", ["session", "bearer"], {
          allowUnauthenticated: true,
        }),
        validateAndTransformBody(StoreSupportReply),
      ],
    },
    {
      matcher: "/admin/support-requests",
      method: ["GET"],
      middlewares: [
        validateAndTransformQuery<BaseEntity>(AdminSupportRequestsQuery, {}),
      ],
      policies: [{ resource: "support_request", operation: "read" }],
    },
    {
      matcher: "/admin/support-requests/:id",
      method: ["GET"],
      policies: [{ resource: "support_request", operation: "read" }],
    },
    {
      matcher: "/admin/support-requests/:id",
      method: ["POST"],
      middlewares: [validateAndTransformBody(AdminUpdateSupportRequest)],
      policies: [{ resource: "support_request", operation: "update" }],
    },
    {
      matcher: "/admin/support-requests/:id/messages",
      method: ["POST"],
      middlewares: [validateAndTransformBody(AdminSupportReply)],
      policies: [{ resource: "support_request", operation: "update" }],
    },
    {
      // Checks the current password, so it is rate limited like sign-in.
      matcher: "/store/customers/me/password/change",
      method: ["POST"],
      middlewares: [
        rateLimit("change-password", 5),
        validateAndTransformBody(StoreChangePassword),
      ],
    },
    {
      matcher: "/store/customers/verify-email",
      method: ["POST"],
      middlewares: [
        rateLimit("verify-email", 20),
        validateAndTransformBody(StoreVerifyCustomerEmail),
      ],
    },
    {
      // Each call sends an email, so a few a minute is plenty.
      matcher: "/store/customers/me/email-verification",
      method: ["POST"],
      middlewares: [rateLimit("verify-email-send", 5)],
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
