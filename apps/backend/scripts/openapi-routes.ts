import { z } from "@medusajs/framework/zod";
import {
  UpdateSearchFallbackTerms,
  UpdateSearchVocabulary,
} from "../src/modules/search-insights/vocabulary-input";
import {
  AnnouncementBar,
  PublicAnnouncements,
  AnnouncementOptionsResponse,
} from "../src/modules/storefront-settings/announcements";

import {
  AdminCreateSizeGuide,
  AdminSetProductComingSoon,
  AdminSetSizeGuide,
  AdminUpdateBranding,
  AdminUpdateNewsletterSettings,
  AdminUpdateSizeGuide,
  AdminUpdateStorefrontSettings,
  AdminUpdateCartReminderSettings,
  AdminUpdateReturnPolicy,
  AdminUpdateSupportInfo,
  AdminUpdateContentPages,
  AdminResolveEmailDelivery,
  AdminRecordCredoRefund,
  AdminRecordPaystackRefund,
  AdminResolvePaymentCheck,
  StoreOrderHelp,
  StoreSupportReply,
  AdminSupportReply,
  AdminUpdateSupportRequest,
  StoreContactMessage,
  AdminCreateOrderFromPayment,
  AdminResendShippingEmail,
  StoreVerifyCustomerEmail,
  StoreChangePassword,
  StoreOrderLookup,
  StoreRequestReturn,
  StoreCartReminderToken,
  SizeGuideTable,
  StoreAddWishlistItem,
  StoreCreateProductAlert,
  StoreCreateSocialCustomer,
  StoreMergeWishlist,
  StoreNewsletterConfirm,
  StoreNewsletterSubscribe,
  StoreNewsletterToken,
  StoreSetCustomerPassword,
  StoreSetMarketingPreference,
} from "../src/api/middlewares";

/**
 * What the custom API routes accept and return.
 *
 * Request bodies reuse the very Zod schemas the routes validate with, so the
 * spec cannot describe a body the server would reject. Responses are written
 * here as Zod too, mirroring each handler's `res.json(...)`.
 *
 * generate-openapi.ts turns this into docs/api/openapi.json and fails if a
 * route file exists that is not listed here (or vice versa).
 */

export type RouteAuth = "public" | "customer" | "admin" | "webhook";

export type RouteDoc = {
  method: "GET" | "POST" | "DELETE";
  /** Express-style path as Medusa serves it, e.g. /store/x/[id] -> {id}. */
  path: string;
  tag: string;
  summary: string;
  description?: string;
  auth: RouteAuth;
  /** RBAC policies declared in src/api/middlewares.ts. */
  policies?: string[];
  query?: { name: string; description: string; schema: z.ZodType }[];
  body?: z.ZodType;
  response: { description: string; schema: z.ZodType };
  errors?: { status: number; description: string }[];
};

const SupportPhotoOut = z.object({ url: z.string(), name: z.string() });
const PublicSupportRequest = z.object({
  id: z.string(),
  reference: z.string(),
  kind: z.string(),
  status: z.enum(["open", "awaiting_customer", "resolved"]),
  order_id: z.string().nullable(),
  order_display_id: z.number().nullable(),
  created_at: z.string(),
  last_message_at: z.string(),
});
const PublicSupportMessage = z.object({
  id: z.string(),
  author: z.enum(["customer", "staff"]),
  author_name: z.string().nullable(),
  body: z.string(),
  photos: z.array(SupportPhotoOut),
  created_at: z.string(),
});

const EmailVerificationState = z.object({
  email: z.string(),
  verified: z.boolean(),
});

const Branding = z.object({
  id: z.string(),
  name: z.string(),
  logo_url: z.string().nullable(),
  favicon_url: z.string().nullable(),
  support_email: z.string().nullable(),
});

const NewsletterSettings = z.object({
  id: z.string(),
  enabled: z.boolean(),
  audience_id: z.string().nullable(),
  double_opt_in: z.boolean(),
  heading: z.string().nullable(),
  description: z.string().nullable(),
  consent_text: z.string().nullable(),
  success_message: z.string().nullable(),
  reply_to: z.string().nullable(),
  checkout_opt_in: z.boolean(),
  checkout_label: z.string().nullable(),
});

/**
 * The public part of the newsletter settings; the audience id and reply-to
 * address stay admin-only. The form shows `consent_text` verbatim, since signup
 * records it as what the subscriber agreed to. `heading` and `description`
 * arrive resolved -- the admin's copy or the default -- so they are never null.
 */
const StoreNewsletter = z.object({
  newsletter: NewsletterSettings.pick({
    enabled: true,
    double_opt_in: true,
    consent_text: true,
  }).extend({
    heading: z.string(),
    description: z.string(),
    /** Show the opt-in checkbox at checkout (signup on and the setting on). */
    checkout_opt_in: z.boolean(),
    /** The checkbox's label, with a default when none is set. */
    checkout_label: z.string(),
  }),
});

const NewsletterSubscriber = z.object({
  id: z.string(),
  email: z.string(),
  first_name: z.string().nullable(),
  status: z.enum(["pending", "subscribed", "unsubscribed"]),
  source: z.string().nullable(),
  consent_text: z.string().nullable(),
  consent_at: z.string().nullable(),
  confirmed_at: z.string().nullable(),
  unsubscribed_at: z.string().nullable(),
  resend_contact_id: z.string().nullable(),
  sync_pending: z.boolean(),
  sync_attempted_at: z.string().nullable(),
  provider_consent_at: z.string().nullable(),
  email_suppressed_at: z.string().nullable(),
  email_suppression_reason: z
    .enum(["hard_bounce", "complaint", "provider_suppression"])
    .nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});

const NewsletterSubscriberStats = z.object({
  confirmed: z.number(),
  pending: z.number(),
  sync_pending: z.number(),
  suppressed: z.number(),
  webhook_pending: z.number(),
});

const ResendAudience = z.object({
  id: z.string(),
  name: z.string(),
});

const Wishlist = z.object({
  id: z.string().nullable(),
  items: z.array(
    z.object({
      id: z.string(),
      product_id: z.string(),
      product_variant_id: z.string().nullable(),
      created_at: z.string(),
    }),
  ),
});

const Acknowledged = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  status: z.string().optional(),
});

const Customer = z.object({
  id: z.string(),
  email: z.string(),
  first_name: z.string().nullable(),
  last_name: z.string().nullable(),
  phone: z.string().nullable(),
  has_account: z.boolean(),
  created_at: z.string(),
});

const ProductAlert = z.object({
  id: z.string(),
  product_id: z.string(),
  variant_id: z.string().nullable(),
  reason: z.enum(["restock", "launch"]),
  status: z.enum(["waiting", "sent", "cancelled", "failed"]),
  created_at: z.string(),
});

const CustomerProductAlert = ProductAlert.extend({
  notified_at: z.string().nullable(),
});

const MarketingPreference = z.object({
  status: z.enum(["none", "pending", "subscribed", "unsubscribed"]),
  available: z.boolean(),
  consent_text: z.string().nullable(),
});

const ProductAlertSummary = z.object({
  waiting: z.number(),
  sent: z.number(),
  by_variant: z.array(
    z.object({ variant_id: z.string().nullable(), count: z.number() }),
  ),
});

const StoreSizeGuide = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  diagram_url: z.string().nullable(),
  unit: z.literal("cm"),
  columns: SizeGuideTable.shape.columns,
  rows: SizeGuideTable.shape.rows,
});

const SizeGuideSource = z.enum(["product", "category", "default"]).nullable();

const NamedRef = z.object({ id: z.string(), name: z.string() });

const AdminSizeGuide = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  diagram_url: z.string().nullable(),
  table: SizeGuideTable,
  is_default: z.boolean(),
  created_at: z.string(),
  updated_at: z.string(),
  product_count: z.number(),
  categories: z.array(NamedRef),
});

const AdminProductSizeGuide = z.object({
  size_guide_id: z.string().nullable(),
  resolved: z.object({
    size_guide: NamedRef.nullable(),
    source: SizeGuideSource,
    category: NamedRef.nullable(),
  }),
});

const AdminCategorySizeGuide = z.object({
  size_guide_id: z.string().nullable(),
  inherited: z.object({ size_guide: NamedRef, category: NamedRef }).nullable(),
});

const StoredSocialLinks = z.object({
  instagram: z.string().nullable(),
  facebook: z.string().nullable(),
  tiktok: z.string().nullable(),
  x: z.string().nullable(),
  youtube: z.string().nullable(),
  pinterest: z.string().nullable(),
});

const StoredHomepageHero = z.object({
  enabled: z.boolean(),
  eyebrow: z.string().nullable(),
  title: z.string().nullable(),
  description: z.string().nullable(),
  /** With a video, the poster shown while it loads or when it can't play. */
  desktop_image_url: z.string().nullable(),
  mobile_image_url: z.string().nullable(),
  /** Set means the hero is a video; null means a photo. */
  desktop_video_url: z.string().nullable(),
  /** Only ever set alongside desktop_video_url. */
  mobile_video_url: z.string().nullable(),
  cta_label: z.string().nullable(),
  cta_url: z.string().nullable(),
});

const StorefrontSettings = z.object({
  id: z.string(),
  new_badge_days: z.number(),
  seo_title: z.string().nullable(),
  seo_description: z.string().nullable(),
  og_image_url: z.string().nullable(),
  twitter_handle: z.string().nullable(),
  social_links: z.record(z.string(), z.string().nullable()),
  allow_indexing: z.boolean(),
  google_site_verification: z.string().nullable(),
  homepage_hero: StoredHomepageHero,
  featured_collection_id: z.string().nullable(),
  store_menu_cards: z.array(
    z.object({
      target_type: z.enum(["collection", "category", "product"]),
      target_id: z.string(),
      image_url: z.string(),
      mobile_image_url: z.string().nullable(),
    }),
  ),
  announcement_bar: AnnouncementBar,
});

const CartReminderSettings = z.object({
  id: z.string(),
  enabled: z.boolean(),
  first_delay_hours: z.number(),
  second_delay_hours: z.number().nullable(),
  third_delay_hours: z.number().nullable(),
});

const CartReminderStats = z.object({
  stats: z.object({
    /** Start of the 30-day period. */
    since: z.string(),
    carts_reminded: z.number(),
    /** Carts reopened from a reminder's "View your bag" link. */
    carts_opened: z.number(),
    /** Orders placed from a cart after it was reminded. */
    orders_recovered: z.number(),
    revenue_recovered: z.array(
      z.object({ currency_code: z.string(), amount: z.number() }),
    ),
    /** Addresses that used a stop link. */
    stopped: z.number(),
  }),
});

const EmailHistoryEntry = z.object({
  /** The delivery ledger ID when known, otherwise the notification's. */
  id: z.string(),
  template: z.string(),
  to: z.string(),
  status: z.enum(["sending", "sent", "failed", "needs_review"]),
  created_at: z.string(),
  sent_at: z.string().nullable(),
  /** The latest Resend delivery event, once one has arrived. */
  outcome: z
    .enum([
      "delivered",
      "delayed",
      "bounced",
      "complained",
      "suppressed",
      "failed",
    ])
    .nullable(),
  outcome_at: z.string().nullable(),
  outcome_detail: z.string().nullable(),
});

const SupportProductRef = z.object({
  id: z.string(),
  title: z.string().nullable(),
  thumbnail: z.string().nullable(),
});

const CustomerSupportContext = z.object({
  email: z.string().nullable(),
  emails: z.array(EmailHistoryEntry),
  newsletter: z
    .object({
      status: z.enum(["pending", "subscribed", "unsubscribed"]),
      confirmed_at: z.string().nullable(),
      unsubscribed_at: z.string().nullable(),
      suppressed_at: z.string().nullable(),
      suppression_reason: z
        .enum(["hard_bounce", "complaint", "provider_suppression"])
        .nullable(),
    })
    .nullable(),
  wishlist: z.object({
    count: z.number(),
    items: z.array(
      z.object({
        id: z.string(),
        product: SupportProductRef,
        variant_title: z.string().nullable(),
        created_at: z.string(),
      }),
    ),
  }),
  product_alerts: z.object({
    count: z.number(),
    items: z.array(
      z.object({
        id: z.string(),
        product: SupportProductRef,
        variant_title: z.string().nullable(),
        reason: z.enum(["restock", "launch"]),
        status: z.enum(["waiting", "sent", "cancelled", "failed"]),
        notified_at: z.string().nullable(),
        created_at: z.string(),
      }),
    ),
  }),
  cart_reminders: z.object({
    count: z.number(),
    /** The address used a reminder's stop link. */
    opted_out: z.boolean(),
    items: z.array(
      z.object({
        id: z.string(),
        cart_id: z.string(),
        status: z.enum([
          "active",
          "finished",
          "recovered",
          "stopped",
          "failed",
        ]),
        reminders_sent: z.number(),
        last_sent_at: z.string().nullable(),
        restored_at: z.string().nullable(),
        recovered_at: z.string().nullable(),
        order_id: z.string().nullable(),
      }),
    ),
  }),
  support_requests: z.object({
    count: z.number(),
    items: z.array(
      z.object({
        id: z.string(),
        reference: z.string(),
        kind: z.string(),
        status: z.enum(["open", "awaiting_customer", "resolved"]),
        order_display_id: z.number().nullable(),
        last_message_at: z.string(),
      }),
    ),
  }),
  /** The rows per section this response used. */
  limit: z.number(),
});

const PaymentAttempt = z.object({
  session_id: z.string(),
  /** As on the customer's receipt; null if the payment page never opened. */
  reference: z.string().nullable(),
  provider_id: z.string(),
  status: z.string(),
  /** In the major unit, as Medusa stores prices. */
  amount: z.number(),
  currency_code: z.string(),
  created_at: z.string(),
  cart: z
    .object({
      id: z.string(),
      email: z.string().nullable(),
      completed_at: z.string().nullable(),
    })
    .nullable(),
  order: z.object({ id: z.string(), display_id: z.number() }).nullable(),
});

const GatewayCheck = z.union([
  z.object({
    checked: z.literal(true),
    status: z.enum(["successful", "pending", "failed", "canceled"]),
    /** Kobo for NGN. */
    amount_in_minor: z.number().nullable(),
    currency_code: z.string().nullable(),
  }),
  z.object({ checked: z.literal(false), reason: z.string() }),
]);

const CatalogFacetValue = z.object({
  value: z.string(),
  /** Products that would show if this value were ticked. */
  count: z.number(),
  /** Colours only: the swatch, when set on the option value. */
  hex: z.string().nullable().optional(),
});

const CatalogListing = z.object({
  /** This page's product ids, in order. Load the cards from /store/products. */
  ids: z.array(z.string()),
  /** Products matching the filters, across all pages. */
  count: z.number(),
  offset: z.number(),
  limit: z.number(),
  facets: z.object({
    type: z.array(CatalogFacetValue),
    colour: z.array(CatalogFacetValue),
    size: z.array(CatalogFacetValue),
    material: z.array(CatalogFacetValue),
    fit: z.array(CatalogFacetValue),
    feature: z.array(CatalogFacetValue),
  }),
});

const HomepageHeroHistory = z.object({
  /** Newest first; only the most recent 10 are kept. */
  revisions: z.array(
    z.object({
      id: z.string(),
      hero: StoredHomepageHero,
      /** When a save replaced this hero. */
      replaced_at: z.string(),
      replaced_by: z
        .object({
          id: z.string(),
          email: z.string().nullable(),
          name: z.string().nullable(),
        })
        .nullable(),
    }),
  ),
});

const PublicStorefrontSettings = z.object({
  navigation: z.object({
    store_menu_cards: z.array(
      z.object({
        title: z.string(),
        href: z.string(),
        image_url: z.string(),
        mobile_image_url: z.string().nullable(),
      }),
    ),
  }),
  brand: z.object({
    name: z.string(),
    logo_url: z.string().nullable(),
    favicon_url: z.string().nullable(),
    support_email: z.string().nullable(),
  }),
  seo: z.object({
    title: z.string().nullable(),
    description: z.string().nullable(),
    og_image_url: z.string().nullable(),
    twitter_handle: z.string().nullable(),
    social_links: StoredSocialLinks,
    allow_indexing: z.boolean(),
    google_site_verification: z.string().nullable(),
  }),
  homepage: z.object({
    /** Render it only when `enabled` is true; text may be saved while off. */
    hero: StoredHomepageHero,
    /** Null when none is set or the collection has since been deleted. */
    featured_collection_id: z.string().nullable(),
  }),
  products: z.object({
    new_badge_days: z.number(),
  }),
  returns: z.lazy(() => ReturnPolicy),
  /** Sign-in methods besides email and password that are switched on. */
  sign_in: z.object({ google: z.boolean() }),
  support: z.lazy(() => SupportInfo),
  /** Whether each page has text; fetch it from /store/content-pages/{page}. */
  pages: z.object({
    about: z.boolean(),
    privacy: z.boolean(),
    terms: z.boolean(),
  }),
});

const SupportInfo = z.object({
  /** e.g. "Monday to Friday, 9am to 6pm (WAT)". */
  hours: z.string().nullable(),
  /** e.g. "within one working day". */
  response_time: z.string().nullable(),
  /** International form, e.g. +2348012345678. */
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  /** Plain text, possibly several lines. */
  delivery_information: z.string().nullable(),
});

const ReturnPolicy = z.object({
  /** Off: customers can't request returns online. */
  enabled: z.boolean(),
  /** Days after delivery (or dispatch, if delivery wasn't recorded). */
  window_days: z.number(),
});

const ReturnOptions = z.object({
  return_policy: ReturnPolicy,
  eligibility: z.object({
    open: z.boolean(),
    /** Why nothing can be returned; null while `open`. */
    reason: z
      .enum(["disabled", "canceled", "not_shipped", "expired", "nothing_left"])
      .nullable(),
    items: z.array(
      z.object({
        item_id: z.string(),
        returnable_quantity: z.number(),
        /** The last moment it can be requested; null while not shipped. */
        return_by: z.string().nullable(),
      }),
    ),
  }),
  /** Returns already requested or received, newest last. */
  returns: z.array(
    z.object({
      id: z.string(),
      status: z.string(),
      created_at: z.string(),
      items: z.array(z.object({ item_id: z.string(), quantity: z.number() })),
    }),
  ),
});

/** Group descriptions, shown as section intros by API viewers. */
/**
 * One hit from the product index. These are the index' own fields, not a
 * product row: prices are absent because they depend on region, currency and
 * any active price list, none of which an index can resolve.
 */
const SearchProduct = z.object({
  id: z.string(),
  title: z.string(),
  subtitle: z.string().nullable(),
  description: z.string().nullable(),
  handle: z.string(),
  thumbnail: z.string().nullable(),
  status: z.string(),
  created_at: z.string(),
  type: z.string().nullable(),
  collection: z.string().nullable(),
  collection_handle: z.string().nullable(),
  categories: z.array(z.string()),
  category_handles: z.array(z.string()),
  tags: z.array(z.string()),
  sales_channel_ids: z.array(z.string()),
});

/**
 * Every facet requested by the search route is a keyword field, so each one
 * comes back as counted values rather than ranges or stats.
 */
const SearchFacet = z.object({
  type: z.literal("value"),
  values: z.array(z.object({ value: z.string(), count: z.number() })),
  other_count: z.number().optional(),
});

/** The four fields the suggestions route returns; enough for a row. */
const SearchSuggestionProduct = z.object({
  id: z.string(),
  title: z.string(),
  handle: z.string(),
  thumbnail: z.string().nullable(),
});

const SearchSuggestions = z.object({
  products: z.array(SearchSuggestionProduct),
  categories: z.array(
    z.object({ id: z.string(), name: z.string(), handle: z.string() }),
  ),
  collections: z.array(
    z.object({ id: z.string(), title: z.string(), handle: z.string() }),
  ),
  /** Every product the term matches, not just the ones returned above. */
  count: z.number(),
});

/**
 * Submitted searches that found something, busiest first -- or, while there
 * are none, the merchant's suggested phrases. Empty when neither applies.
 */
const SearchTrending = z.object({
  terms: z.array(z.string()),
  /** `curated` terms were chosen by the merchant, not searched by shoppers. */
  source: z.enum(["trending", "curated"]),
});

const SearchResult = z.object({
  products: z.array(SearchProduct),
  count: z.number(),
  limit: z.number(),
  offset: z.number(),
  facets: z.record(z.string(), SearchFacet),
});

export const TAGS: Record<string, string> = {
  Accounts:
    "Customer accounts beyond Medusa's built-in routes: finishing a social sign-in so one person keeps one customer record.",
  Branding:
    "The store's name, logo and support email, used across customer emails and the storefront.",
  Newsletter:
    "Signup, double opt-in confirmation and unsubscribe, plus the admin side: settings, subscribers and the Resend audiences they sync to.",
  Search:
    "Full-text product search over the Search Module's index, with counted facets for refining a results page.",
  Wishlist:
    "Products a shopper has saved. One entry per product, optionally remembering the colour and size they chose. Signed-in customers use /store/customers/me/wishlist; guests use /store/wishlists, where the wishlist ID works like a guest cart's ID, and the guest list is merged into the customer's at sign-in.",
  "Product alerts":
    '"Notify me" for sold-out sizes and coming-soon products. One email per alert, sent within about 10 minutes of the item becoming buyable, then the alert is done. Asking for an alert is not marketing consent.',
  Marketing:
    "A signed-in customer's marketing email preference, backed by the newsletter list and its double opt-in.",
  "Cart reminders":
    'Emails reminding shoppers about carts they left (their "shopping bag" on the storefront), at up to three delays after the cart\'s last change, with links to restore the cart or stop reminders.',
  Storefront:
    "Settings the storefront renders with, edited from Settings › Storefront: home page content (hero, featured collection), sharing & search defaults (title, description, share image, social profiles, indexing, Search Console verification) and product display (New badge days). The public route also includes the brand.",
  "Size guides":
    "Measurement tables for product pages. A product shows its own guide, else the nearest category's (walking up the category tree), else the store default. Measurements are stored in cm; the storefront converts to inches for display.",
  Returns:
    "Customer self-service after purchase: finding a guest order from its number and email, what can still be returned under the store's return policy, and requesting a return. A request becomes a requested return in the admin, without return shipping; staff arrange collection, receive the items and refund.",
  Support:
    "Context for customer support in the admin: the emails sent about an order or to a customer and whether they arrived, resending an order confirmation, a customer's saved items, alerts and cart reminders, and looking up payments that didn't become orders.",
  Operations:
    "Endpoints for deployment and monitoring rather than shoppers or staff.",
  Scaffolding:
    "Placeholder routes left by the Medusa starter. They return 200 with no body and can be deleted.",
};

/**
 * The types shared with the storefront, emitted to packages/api-types.
 *
 * `io` decides which side of the schema is described: "input" is what a
 * client sends (optional fields stay optional), "output" is what the server
 * returns. Names are the storefront's public API -- renaming one is a
 * breaking change for whoever imports it.
 */
export const TYPES: {
  name: string;
  schema: z.ZodType;
  io: "input" | "output";
}[] = [
  // Entities
  { name: "Branding", schema: Branding, io: "output" },
  { name: "NewsletterSettings", schema: NewsletterSettings, io: "output" },
  { name: "NewsletterSubscriber", schema: NewsletterSubscriber, io: "output" },
  { name: "ResendAudience", schema: ResendAudience, io: "output" },
  { name: "Wishlist", schema: Wishlist, io: "output" },
  { name: "Customer", schema: Customer, io: "output" },

  // Request bodies
  { name: "AdminUpdateBrandingBody", schema: AdminUpdateBranding, io: "input" },
  {
    name: "AdminUpdateNewsletterSettingsBody",
    schema: AdminUpdateNewsletterSettings,
    io: "input",
  },
  {
    name: "StoreNewsletterSubscribeBody",
    schema: StoreNewsletterSubscribe,
    io: "input",
  },
  {
    name: "StoreNewsletterConfirmBody",
    schema: StoreNewsletterConfirm,
    io: "input",
  },
  {
    name: "StoreNewsletterTokenBody",
    schema: StoreNewsletterToken,
    io: "input",
  },
  {
    name: "StoreCreateSocialCustomerBody",
    schema: StoreCreateSocialCustomer,
    io: "input",
  },
  {
    name: "StoreSetCustomerPasswordBody",
    schema: StoreSetCustomerPassword,
    io: "input",
  },
  {
    name: "StoreAddWishlistItemBody",
    schema: StoreAddWishlistItem,
    io: "input",
  },
  {
    name: "StoreMergeWishlistBody",
    schema: StoreMergeWishlist,
    io: "input",
  },

  // Response payloads
  {
    name: "AdminBrandingResponse",
    schema: z.object({ branding: Branding }),
    io: "output",
  },
  {
    name: "AdminNewsletterSettingsResponse",
    schema: z.object({ settings: NewsletterSettings }),
    io: "output",
  },
  {
    name: "AdminNewsletterSubscribersResponse",
    schema: z.object({
      stats: NewsletterSubscriberStats,
      subscribers: z.array(NewsletterSubscriber),
      count: z.number(),
      limit: z.number(),
      offset: z.number(),
    }),
    io: "output",
  },
  {
    name: "AdminNewsletterAudiencesResponse",
    schema: z.object({ audiences: z.array(ResendAudience) }),
    io: "output",
  },
  { name: "StoreNewsletterResponse", schema: StoreNewsletter, io: "output" },
  { name: "StoreNewsletterAckResponse", schema: Acknowledged, io: "output" },
  {
    name: "StoreWishlistResponse",
    schema: z.object({ wishlist: Wishlist }),
    io: "output",
  },
  {
    name: "StoreSocialCustomerResponse",
    schema: z.object({ customer: Customer, linked: z.boolean() }),
    io: "output",
  },
  {
    name: "StoreSetCustomerPasswordResponse",
    schema: z.object({ success: z.boolean() }),
    io: "output",
  },
  { name: "ProductAlert", schema: CustomerProductAlert, io: "output" },
  { name: "MarketingPreference", schema: MarketingPreference, io: "output" },
  {
    name: "StoreCreateProductAlertBody",
    schema: StoreCreateProductAlert,
    io: "input",
  },
  {
    name: "StoreCreateProductAlertResponse",
    schema: z.object({
      success: z.boolean(),
      alert: ProductAlert.nullable(),
    }),
    io: "output",
  },
  {
    name: "StoreProductAlertsResponse",
    schema: z.object({ alerts: z.array(CustomerProductAlert) }),
    io: "output",
  },
  {
    name: "StoreSetMarketingPreferenceBody",
    schema: StoreSetMarketingPreference,
    io: "input",
  },
  {
    name: "StoreMarketingPreferenceResponse",
    schema: z.object({ marketing: MarketingPreference }),
    io: "output",
  },
  {
    name: "AdminSetProductComingSoonBody",
    schema: AdminSetProductComingSoon,
    io: "input",
  },
  { name: "SizeGuideTable", schema: SizeGuideTable, io: "output" },
  { name: "StoreSizeGuide", schema: StoreSizeGuide, io: "output" },
  {
    name: "StoreSizeGuideResponse",
    schema: z.object({
      size_guide: StoreSizeGuide.nullable(),
      source: SizeGuideSource,
    }),
    io: "output",
  },
  { name: "AdminSizeGuide", schema: AdminSizeGuide, io: "output" },
  {
    name: "AdminCreateSizeGuideBody",
    schema: AdminCreateSizeGuide,
    io: "input",
  },
  {
    name: "AdminUpdateSizeGuideBody",
    schema: AdminUpdateSizeGuide,
    io: "input",
  },
  { name: "AdminSetSizeGuideBody", schema: AdminSetSizeGuide, io: "input" },
  { name: "StorefrontSettings", schema: StorefrontSettings, io: "output" },
  { name: "StoreCatalogResponse", schema: CatalogListing, io: "output" },
  { name: "StoreCatalogFacetValue", schema: CatalogFacetValue, io: "output" },
  { name: "StoreOrderLookupBody", schema: StoreOrderLookup, io: "input" },
  {
    name: "StoreOrderLookupResponse",
    schema: z.object({ sent: z.literal(true) }),
    io: "output",
  },
  { name: "StoreReturnOptionsResponse", schema: ReturnOptions, io: "output" },
  { name: "StoreRequestReturnBody", schema: StoreRequestReturn, io: "input" },
  {
    name: "StoreRequestReturnResponse",
    schema: z.object({ return: z.object({ id: z.string() }) }),
    io: "output",
  },
  {
    name: "StoreAnnouncementsResponse",
    schema: PublicAnnouncements,
    io: "output",
  },
  {
    name: "AdminAnnouncementOptionsResponse",
    schema: AnnouncementOptionsResponse,
    io: "output",
  },
  {
    name: "AdminUpdateStorefrontSettingsBody",
    schema: AdminUpdateStorefrontSettings,
    io: "input",
  },
  {
    name: "AdminStorefrontSettingsResponse",
    schema: z.object({ settings: StorefrontSettings }),
    io: "output",
  },
  {
    name: "AdminHomepageHeroHistoryResponse",
    schema: HomepageHeroHistory,
    io: "output",
  },
  {
    name: "StoreStorefrontSettingsResponse",
    schema: z.object({ settings: PublicStorefrontSettings }),
    io: "output",
  },
  { name: "StoreSearchProduct", schema: SearchProduct, io: "output" },
  { name: "StoreSearchResponse", schema: SearchResult, io: "output" },
  {
    name: "StoreSearchSuggestionProduct",
    schema: SearchSuggestionProduct,
    io: "output",
  },
  {
    name: "StoreSearchSuggestionsResponse",
    schema: SearchSuggestions,
    io: "output",
  },
  { name: "StoreSearchTrendingResponse", schema: SearchTrending, io: "output" },
  {
    name: "AdminCartReminderSettingsResponse",
    schema: z.object({ settings: CartReminderSettings }),
    io: "output",
  },
  {
    name: "AdminUpdateCartReminderSettingsBody",
    schema: AdminUpdateCartReminderSettings,
    io: "input",
  },
  {
    name: "AdminCartReminderStatsResponse",
    schema: CartReminderStats,
    io: "output",
  },
  {
    name: "StoreCartReminderTokenBody",
    schema: StoreCartReminderToken,
    io: "input",
  },
  {
    name: "StoreRestoreCartResponse",
    schema: z.object({ cart_id: z.string() }),
    io: "output",
  },
  {
    name: "StoreStopCartRemindersResponse",
    schema: z.object({ status: z.string() }),
    io: "output",
  },
];

export const ROUTES: RouteDoc[] = [
  {
    method: "GET",
    path: "/admin/search-vocabulary",
    tag: "Search",
    summary: "Get approved trending-search phrases",
    auth: "admin",
    policies: ["storefront_settings:read"],
    response: {
      description:
        "Current phrases and concurrency revision. Environment fallback applies only before the first admin save.",
      schema: z.object({
        vocabulary: z.object({
          terms: z.array(z.string()),
          revision: z.string().nullable(),
          source: z.enum(["admin", "environment"]),
        }),
      }),
    },
  },
  {
    method: "POST",
    path: "/admin/search-vocabulary",
    tag: "Search",
    summary: "Replace approved trending-search phrases",
    auth: "admin",
    policies: ["storefront_settings:update"],
    body: UpdateSearchVocabulary,
    description:
      "Up to 100 reviewed phrases; normalized and deduplicated. An empty list disables trending. Send the revision from GET to prevent overwriting another admin's changes.",
    response: {
      description: "Saved vocabulary.",
      schema: z.object({
        vocabulary: z.object({
          terms: z.array(z.string()),
          revision: z.string(),
          source: z.literal("admin"),
        }),
      }),
    },
    errors: [
      { status: 400, description: "Invalid phrase list." },
      { status: 409, description: "Revision is stale; reload before saving." },
    ],
  },
  {
    method: "GET",
    path: "/admin/search-fallback-terms",
    tag: "Search",
    summary: "Get search fallback phrases",
    auth: "admin",
    policies: ["storefront_settings:read"],
    description:
      "Reviewed phrases shown in search when nothing is trending, with the revision to send back when saving.",
    response: {
      description: "Current phrases and concurrency revision.",
      schema: z.object({
        fallback: z.object({
          terms: z.array(z.string()),
          revision: z.string().nullable(),
        }),
      }),
    },
  },
  {
    method: "POST",
    path: "/admin/search-fallback-terms",
    tag: "Search",
    summary: "Replace search fallback phrases",
    auth: "admin",
    policies: ["storefront_settings:update"],
    body: UpdateSearchFallbackTerms,
    description:
      "Up to 10 reviewed phrases; normalized and deduplicated. Send the revision from GET to prevent overwriting another admin's changes.",
    response: {
      description: "Saved phrases.",
      schema: z.object({
        fallback: z.object({
          terms: z.array(z.string()),
          revision: z.string(),
        }),
      }),
    },
    errors: [
      { status: 400, description: "Invalid phrase list." },
      { status: 409, description: "Revision is stale; reload before saving." },
    ],
  },
  {
    method: "GET",
    path: "/store/announcements",
    tag: "Storefront",
    auth: "public",
    summary: "Get live header announcements",
    description:
      "Uncached, ordered live announcements filtered by schedule, destination visibility, and linked offer availability. Refresh by valid_until; never display an expired snapshot.",
    response: {
      description: "Live announcements and snapshot expiry.",
      schema: PublicAnnouncements,
    },
  },
  {
    method: "GET",
    path: "/admin/storefront-settings/announcement-options",
    tag: "Storefront",
    auth: "admin",
    policies: ["storefront_settings:read"],
    summary: "Search announcement destinations and related promotions",
    query: [
      {
        name: "type",
        description: "Record type.",
        schema: z.enum(["collection", "category", "product", "promotion"]),
      },
      {
        name: "q",
        description: "Search label.",
        schema: z.string().optional(),
      },
      {
        name: "id",
        description: "Retrieve a selected record.",
        schema: z.string().optional(),
      },
      {
        name: "offset",
        description: "Pagination offset (20 per page).",
        schema: z.number().optional(),
      },
    ],
    response: {
      description: "Matching options.",
      schema: AnnouncementOptionsResponse,
    },
  },
  {
    method: "GET",
    path: "/admin/storefront-settings",
    tag: "Storefront",
    summary: "Get storefront settings",
    description: "Created with defaults (a 30-day New badge) on first read.",
    auth: "admin",
    policies: ["storefront_settings:read"],
    response: {
      description: "The storefront settings.",
      schema: z.object({ settings: StorefrontSettings }),
    },
  },
  {
    method: "POST",
    path: "/admin/storefront-settings",
    tag: "Storefront",
    summary: "Update storefront settings",
    description: "Only the fields sent change.",
    auth: "admin",
    policies: ["storefront_settings:update"],
    body: AdminUpdateStorefrontSettings,
    response: {
      description: "The updated settings.",
      schema: z.object({ settings: StorefrontSettings }),
    },
    errors: [
      {
        status: 400,
        description:
          "Validation failed: `new_badge_days` must be a whole number from 1 to 365.",
      },
    ],
  },
  {
    method: "GET",
    path: "/admin/storefront-settings/hero-history",
    tag: "Storefront",
    summary: "List previous home page heroes",
    description:
      "Heroes replaced by earlier saves, newest first, with when and by whom. A save records the hero it replaces only when the hero changed and had content; the 10 most recent are kept.",
    auth: "admin",
    policies: ["storefront_settings:read"],
    response: {
      description: "The hero history.",
      schema: HomepageHeroHistory,
    },
  },
  {
    method: "POST",
    path: "/admin/storefront-settings/hero-history/{id}/restore",
    tag: "Storefront",
    summary: "Restore a previous home page hero",
    description:
      "Makes the hero current exactly as it was saved, shown or hidden. The hero it replaces joins the history, so a restore can be undone.",
    auth: "admin",
    policies: ["storefront_settings:update"],
    response: {
      description: "The updated settings.",
      schema: z.object({ settings: StorefrontSettings }),
    },
    errors: [
      {
        status: 404,
        description: "The previous hero is no longer kept.",
      },
      {
        status: 400,
        description: "The hero no longer meets today's validation rules.",
      },
    ],
  },
  {
    method: "GET",
    path: "/store/storefront-settings",
    tag: "Storefront",
    summary: "Get the settings the storefront renders with",
    description:
      "Everything the storefront renders its shell with: `brand` (name, logo, favicon, support email), `seo` (defaults for search results and link previews, social profiles, whether search engines may index the store, Search Console code) `products` (New badge days) `returns` (whether customers can request returns online, and the window in days), `support` (contact details and delivery information; each null when not set), `pages` (whether the About, Privacy and Terms pages have text) and `sign_in` (whether the Google sign-in button should show). Public and identical for every shopper, so it is safe to read from cached pages.",
    auth: "public",
    response: {
      description: "The public storefront settings.",
      schema: z.object({ settings: PublicStorefrontSettings }),
    },
  },
  {
    method: "GET",
    path: "/admin/size-guides",
    tag: "Size guides",
    summary: "List size guides",
    description:
      "All guides, sorted by name, with the categories that use each as their default and how many products use it as an override.",
    auth: "admin",
    policies: ["size_guide:read"],
    response: {
      description: "The size guides.",
      schema: z.object({ size_guides: z.array(AdminSizeGuide) }),
    },
  },
  {
    method: "POST",
    path: "/admin/size-guides",
    tag: "Size guides",
    summary: "Create a size guide",
    description:
      "Measurement cells are cm numbers or [min, max] ranges; text columns hold strings. Every row's `size` must be a value of the shared Size option. `is_default: true` makes this the store default and clears the previous one.",
    auth: "admin",
    policies: ["size_guide:create"],
    body: AdminCreateSizeGuide,
    response: {
      description: "The new size guide.",
      schema: z.object({ size_guide: AdminSizeGuide }),
    },
    errors: [
      {
        status: 400,
        description:
          "Validation failed: a duplicate column or size, a cell that does not match its column type, a backwards range, or a size that is not a Size option value. The message lists every problem.",
      },
    ],
  },
  {
    method: "GET",
    path: "/admin/size-guides/{id}",
    tag: "Size guides",
    summary: "Get a size guide",
    auth: "admin",
    policies: ["size_guide:read"],
    response: {
      description: "The size guide.",
      schema: z.object({ size_guide: AdminSizeGuide }),
    },
    errors: [{ status: 404, description: "No such size guide." }],
  },
  {
    method: "POST",
    path: "/admin/size-guides/{id}",
    tag: "Size guides",
    summary: "Update a size guide",
    description:
      "Only the fields sent change. A `table` replaces the whole table and is validated like on create.",
    auth: "admin",
    policies: ["size_guide:update"],
    body: AdminUpdateSizeGuide,
    response: {
      description: "The updated size guide.",
      schema: z.object({ size_guide: AdminSizeGuide }),
    },
    errors: [
      { status: 400, description: "Validation failed; see create." },
      { status: 404, description: "No such size guide." },
    ],
  },
  {
    method: "DELETE",
    path: "/admin/size-guides/{id}",
    tag: "Size guides",
    summary: "Delete a size guide",
    description:
      "Also removes it from the products and categories using it; they fall back to their category's guide or the store default.",
    auth: "admin",
    policies: ["size_guide:delete"],
    response: {
      description: "The size guide is deleted.",
      schema: z.object({
        id: z.string(),
        object: z.literal("size_guide"),
        deleted: z.boolean(),
      }),
    },
    errors: [{ status: 404, description: "No such size guide." }],
  },
  {
    method: "GET",
    path: "/admin/products/{id}/size-guide",
    tag: "Size guides",
    summary: "Get a product's size guide",
    description:
      "`size_guide_id` is the product's own override (null when it inherits). `resolved` is the guide the product page actually shows and where it comes from.",
    auth: "admin",
    policies: ["product:read"],
    response: {
      description: "The product's guide.",
      schema: AdminProductSizeGuide,
    },
    errors: [{ status: 404, description: "No such product." }],
  },
  {
    method: "POST",
    path: "/admin/products/{id}/size-guide",
    tag: "Size guides",
    summary: "Set or clear a product's size guide",
    description:
      "`size_guide_id: null` removes the override, so the product uses its category's guide again.",
    auth: "admin",
    policies: ["product:update"],
    body: AdminSetSizeGuide,
    response: {
      description: "The product's guide after the change.",
      schema: AdminProductSizeGuide,
    },
    errors: [{ status: 404, description: "No such product or size guide." }],
  },
  {
    method: "GET",
    path: "/admin/product-categories/{id}/size-guide",
    tag: "Size guides",
    summary: "Get a category's size guide",
    description:
      "`size_guide_id` is the category's own guide. `inherited` is the nearest parent category's guide, which its products use while it has none.",
    auth: "admin",
    policies: ["product_category:read"],
    response: {
      description: "The category's guide.",
      schema: AdminCategorySizeGuide,
    },
    errors: [{ status: 404, description: "No such category." }],
  },
  {
    method: "POST",
    path: "/admin/product-categories/{id}/size-guide",
    tag: "Size guides",
    summary: "Set or clear a category's size guide",
    description:
      "Applies to the category's products and to subcategories without their own guide. `size_guide_id: null` removes it.",
    auth: "admin",
    policies: ["product_category:update"],
    body: AdminSetSizeGuide,
    response: {
      description: "The category's guide after the change.",
      schema: AdminCategorySizeGuide,
    },
    errors: [{ status: 404, description: "No such category or size guide." }],
  },
  {
    method: "GET",
    path: "/store/products/{id}/size-guide",
    tag: "Size guides",
    summary: "Get the size guide for a product page",
    description:
      "The product's own guide, else the nearest category's, else the store default. `size_guide` is null when none applies: hide the size guide link. Measurements are in cm; convert for an inches view. Reads no customer data, so it is safe for cached pages.",
    auth: "public",
    response: {
      description: "The guide, and where it comes from.",
      schema: z.object({
        size_guide: StoreSizeGuide.nullable(),
        source: SizeGuideSource,
      }),
    },
    errors: [{ status: 404, description: "No such published product." }],
  },
  {
    method: "GET",
    path: "/admin/products/{id}/alerts",
    tag: "Product alerts",
    summary: "Count shoppers waiting on a product",
    description:
      "Counts only, per variant; a null `variant_id` counts alerts for any size.",
    auth: "admin",
    policies: ["product:read"],
    response: {
      description: "Waiting and already-notified counts.",
      schema: z.object({ alerts: ProductAlertSummary }),
    },
  },
  {
    method: "POST",
    path: "/admin/products/{id}/coming-soon",
    tag: "Product alerts",
    summary: "Turn coming soon on or off",
    description:
      "Sets `metadata.coming_soon` without touching other metadata. While on, the product stays published, can't be added to a cart or checked out, and shoppers can ask to be notified. Turning it off emails waiting shoppers on the next alert run once the product has stock. Turning it off on a product that was coming soon is its launch: `metadata.launched_at` is set to now (ISO 8601), which the storefront's \"New\" badge counts from.",
    auth: "admin",
    policies: ["product:update"],
    body: AdminSetProductComingSoon,
    response: {
      description:
        "The new setting, and the launch date if the product has ever been launched from coming soon.",
      schema: z.object({
        product: z.object({
          id: z.string(),
          coming_soon: z.boolean(),
          launched_at: z.string().nullable(),
        }),
      }),
    },
    errors: [{ status: 404, description: "No such product." }],
  },
  {
    method: "POST",
    path: "/store/products/{id}/alerts",
    tag: "Product alerts",
    summary: "Ask to be notified when a product can be bought",
    description:
      "For a sold-out variant (or product) or a coming-soon product. Signed in, the account's email is used and any `email` in the body is ignored; as a guest, `email` is required. Nothing is emailed until the item can be bought. Asking again for the same item returns the waiting alert. `marketing_opt_in` also signs the address up for the newsletter, with its confirmation email; a closed newsletter does not fail the request. Guests always get `alert: null`, so the response does not reveal existing alerts.",
    auth: "public",
    body: StoreCreateProductAlert,
    response: {
      description: "The alert was recorded.",
      schema: z.object({
        success: z.boolean(),
        alert: ProductAlert.nullable(),
      }),
    },
    errors: [
      {
        status: 400,
        description:
          "Validation failed, no email for a guest, the variant is not part of the product, the item can be bought now, or the address is waiting on 50 items already.",
      },
      { status: 404, description: "No such published product." },
    ],
  },
  {
    method: "GET",
    path: "/store/customers/me/product-alerts",
    tag: "Product alerts",
    summary: "List the customer's alerts",
    description:
      "Waiting and sent alerts, newest first, up to 100. IDs only: load products through /store/products.",
    auth: "customer",
    response: {
      description: "The alerts.",
      schema: z.object({ alerts: z.array(CustomerProductAlert) }),
    },
    errors: [{ status: 401, description: "No customer is logged in." }],
  },
  {
    method: "DELETE",
    path: "/store/customers/me/product-alerts/{id}",
    tag: "Product alerts",
    summary: "Cancel one of the customer's alerts",
    description: "Cancelling an alert that was already sent does nothing.",
    auth: "customer",
    response: {
      description: "The alert is cancelled.",
      schema: z.object({
        id: z.string(),
        object: z.literal("product_alert"),
        deleted: z.boolean(),
      }),
    },
    errors: [
      { status: 401, description: "No customer is logged in." },
      {
        status: 404,
        description:
          "No such alert for this customer. Another customer's alert reads as not found.",
      },
    ],
  },
  {
    method: "GET",
    path: "/store/customers/me/marketing",
    tag: "Marketing",
    summary: "Get the customer's marketing email preference",
    description:
      "The newsletter status of the account's email address. `pending` means a confirmation email was sent and not yet clicked. `available` is false while signup is switched off in the admin.",
    auth: "customer",
    response: {
      description: "The preference.",
      schema: z.object({ marketing: MarketingPreference }),
    },
    errors: [{ status: 401, description: "No customer is logged in." }],
  },
  {
    method: "POST",
    path: "/store/customers/me/marketing",
    tag: "Marketing",
    summary: "Turn marketing email on or off",
    description:
      "On runs the newsletter signup for the account's email, including the double opt-in confirmation email when that is enabled, so the status becomes `pending` first. Off unsubscribes the address straight away.",
    auth: "customer",
    body: StoreSetMarketingPreference,
    response: {
      description: "The preference after the change.",
      schema: z.object({ marketing: MarketingPreference }),
    },
    errors: [
      { status: 400, description: "Newsletter signup is switched off." },
      { status: 401, description: "No customer is logged in." },
    ],
  },
  {
    method: "GET",
    path: "/store/customers/me/email-verification",
    tag: "Customers",
    summary: "Whether the customer's email is verified",
    description:
      "True once the customer opened a verification link for the account's current email, or when Google verified the same email address currently on the account.",
    auth: "customer",
    response: {
      description: "The account's email and whether it is verified.",
      schema: EmailVerificationState,
    },
    errors: [{ status: 401, description: "No customer is logged in." }],
  },
  {
    method: "POST",
    path: "/store/customers/me/email-verification",
    tag: "Customers",
    summary: "Send a verification email",
    description:
      "Emails a single-use link, valid for 15 minutes, to the account's own email (never one from the request). Sending again replaces the previous link. Nothing is sent once the email is verified. Rate limited to 5 a minute.",
    auth: "customer",
    response: {
      description: "Whether an email was sent.",
      schema: EmailVerificationState.extend({ sent: z.boolean() }),
    },
    errors: [
      { status: 401, description: "No customer is logged in." },
      { status: 429, description: "Too many requests." },
    ],
  },
  {
    method: "POST",
    path: "/store/customers/verify-email",
    tag: "Customers",
    summary: "Confirm a verification link",
    description:
      "Spends the token from a verification email; no sign-in is needed. Only counts if the account still uses the email it was sent to. Afterwards the orders placed as a guest with that email move into the account in the background, recorded on each order as a transfer. Rate limited to 20 a minute.",
    auth: "public",
    body: StoreVerifyCustomerEmail,
    response: {
      description: "The verified email.",
      schema: z.object({ email: z.string(), verified: z.literal(true) }),
    },
    errors: [
      {
        status: 400,
        description:
          "The link is invalid, used, expired, or for an email the account no longer uses.",
      },
      { status: 429, description: "Too many requests." },
    ],
  },
  {
    method: "GET",
    path: "/admin/branding",
    tag: "Branding",
    summary: "Get store branding",
    description:
      "Store name, logo, favicon and support email. The name, logo and support email appear in customer emails. Created from environment variables on first read.",
    auth: "admin",
    policies: ["branding:read"],
    response: {
      description: "The store's branding.",
      schema: z.object({ branding: Branding }),
    },
  },
  {
    method: "POST",
    path: "/admin/branding",
    tag: "Branding",
    summary: "Update store branding",
    auth: "admin",
    policies: ["branding:update"],
    body: AdminUpdateBranding,
    response: {
      description: "The updated branding.",
      schema: z.object({ branding: Branding }),
    },
    errors: [{ status: 400, description: "Validation failed." }],
  },
  {
    method: "GET",
    path: "/admin/newsletter/settings",
    tag: "Newsletter",
    summary: "Get newsletter settings",
    auth: "admin",
    policies: ["newsletter:read"],
    response: {
      description: "Signup configuration.",
      schema: z.object({ settings: NewsletterSettings }),
    },
  },
  {
    method: "POST",
    path: "/admin/newsletter/settings",
    tag: "Newsletter",
    summary: "Update newsletter settings",
    auth: "admin",
    policies: ["newsletter:update"],
    body: AdminUpdateNewsletterSettings,
    response: {
      description: "The updated settings.",
      schema: z.object({ settings: NewsletterSettings }),
    },
    errors: [{ status: 400, description: "Validation failed." }],
  },
  {
    method: "GET",
    path: "/admin/newsletter/subscribers",
    tag: "Newsletter",
    summary: "List newsletter subscribers",
    description:
      "Newest first. Includes contact sync state, never link credentials.",
    auth: "admin",
    policies: ["newsletter:read"],
    query: [
      {
        name: "limit",
        description: "Page size, 1 to 100 (default 50).",
        schema: z.coerce.number().int().min(1).max(100).optional(),
      },
      {
        name: "offset",
        description: "Records to skip (default 0).",
        schema: z.coerce.number().optional(),
      },
      {
        name: "status",
        description: "Filter by subscription status.",
        schema: z.enum(["pending", "subscribed", "unsubscribed"]).optional(),
      },
    ],
    response: {
      description: "A page of subscribers.",
      schema: z.object({
        stats: NewsletterSubscriberStats,
        subscribers: z.array(NewsletterSubscriber),
        count: z.number(),
        limit: z.number(),
        offset: z.number(),
      }),
    },
  },
  {
    method: "GET",
    path: "/admin/newsletter/audiences",
    tag: "Newsletter",
    summary: "List Resend audiences",
    description:
      "Audiences available in the connected Resend account, for choosing where confirmed contacts are synced.",
    auth: "admin",
    policies: ["newsletter:read"],
    response: {
      description: "Audiences from Resend.",
      schema: z.object({ audiences: z.array(ResendAudience) }),
    },
  },
  {
    method: "GET",
    path: "/store/newsletter",
    tag: "Newsletter",
    summary: "Get public newsletter settings",
    description:
      "Whether signup is on, and the consent wording the form must show verbatim: signup records it on the subscriber as what they agreed to.",
    auth: "public",
    response: {
      description: "Public newsletter settings.",
      schema: StoreNewsletter,
    },
  },
  {
    method: "POST",
    path: "/store/newsletter/subscribe",
    tag: "Newsletter",
    summary: "Sign up for the newsletter",
    description:
      "Public. Always answers the same way whether the address is new, pending or already subscribed, so membership cannot be probed.",
    auth: "public",
    body: StoreNewsletterSubscribe,
    response: {
      description: "Signup accepted.",
      schema: Acknowledged,
    },
    errors: [{ status: 400, description: "Validation failed." }],
  },
  {
    method: "POST",
    path: "/store/newsletter/confirm",
    tag: "Newsletter",
    summary: "Confirm a subscription",
    description:
      "Takes the token from the confirmation email and the subscriber’s first name. Saves the name when confirming; repeat confirmations leave it unchanged.",
    auth: "public",
    body: StoreNewsletterConfirm,
    response: { description: "Subscription confirmed.", schema: Acknowledged },
    errors: [
      { status: 400, description: "Missing or invalid token or first name." },
      { status: 404, description: "Unknown, expired or revoked token." },
    ],
  },
  {
    method: "POST",
    path: "/store/newsletter/unsubscribe",
    tag: "Newsletter",
    summary: "Unsubscribe",
    description:
      "Takes the token from the unsubscribe link in any newsletter email.",
    auth: "public",
    body: StoreNewsletterToken,
    response: { description: "Unsubscribed.", schema: Acknowledged },
    errors: [{ status: 400, description: "Missing, unknown or used token." }],
  },
  {
    method: "POST",
    path: "/store/cart-reminders/restore",
    tag: "Cart reminders",
    summary: "Restore a cart from a reminder email",
    description:
      "Takes the token from a reminder's \"View your bag\" link (`/shopping-bag/restore?token=`) and returns the cart id, for the storefront to set as the shopper's cart.",
    auth: "public",
    body: StoreCartReminderToken,
    response: {
      description: "The cart.",
      schema: z.object({ cart_id: z.string() }),
    },
    errors: [
      { status: 400, description: "The token is malformed." },
      {
        status: 404,
        description: "Unknown token, or the cart was checked out or deleted.",
      },
    ],
  },
  {
    method: "POST",
    path: "/store/cart-reminders/stop",
    tag: "Cart reminders",
    summary: "Stop cart reminders",
    description:
      "Takes the token from a reminder's stop link (`/shopping-bag/reminders/stop?token=`). No more cart reminders are sent to that address, for any cart. Calling it again changes nothing.",
    auth: "public",
    body: StoreCartReminderToken,
    response: {
      description: "Stopped.",
      schema: z.object({ status: z.string() }),
    },
    errors: [
      { status: 400, description: "The token is malformed." },
      { status: 404, description: "Unknown token." },
    ],
  },
  {
    method: "GET",
    path: "/admin/cart-reminders/settings",
    tag: "Cart reminders",
    summary: "Get cart reminder settings",
    description:
      "Created on first read, with reminders off and delays of 1, 24 and 168 hours.",
    auth: "admin",
    policies: ["cart_reminder:read"],
    response: {
      description: "The settings.",
      schema: z.object({ settings: CartReminderSettings }),
    },
  },
  {
    method: "POST",
    path: "/admin/cart-reminders/settings",
    tag: "Cart reminders",
    summary: "Update cart reminder settings",
    description:
      "Only the fields sent change. Delays are hours after the cart's last change; null turns the second or third reminder off. The delays must stay in order.",
    auth: "admin",
    policies: ["cart_reminder:update"],
    body: AdminUpdateCartReminderSettings,
    response: {
      description: "The updated settings.",
      schema: z.object({ settings: CartReminderSettings }),
    },
    errors: [
      {
        status: 400,
        description:
          "A delay is out of range, or the delays would be out of order.",
      },
    ],
  },
  {
    method: "GET",
    path: "/admin/cart-reminders/stats",
    tag: "Cart reminders",
    summary: "Cart reminder results",
    description:
      "The last 30 days: carts reminded, carts reopened from an email, orders placed from reminded carts and their value, and addresses that stopped reminders.",
    auth: "admin",
    policies: ["cart_reminder:read"],
    response: { description: "The results.", schema: CartReminderStats },
  },
  {
    method: "POST",
    path: "/store/customers/social",
    tag: "Accounts",
    summary: "Finish a social sign-in",
    description:
      "Call this with the token from GET /auth/customer/{provider}/callback instead of POST /store/customers. Existing password accounts must have verified their email before Google can link to them. Otherwise a new customer is created. Only providers that verify email ownership (currently Google) may link; an emailpass identity is rejected.",
    auth: "customer",
    body: StoreCreateSocialCustomer,
    response: {
      description: "The customer this sign-in now belongs to.",
      schema: z.object({ customer: Customer, linked: z.boolean() }),
    },
    errors: [
      {
        status: 400,
        description:
          "The sign-in returned no email address, or the existing password account has not verified it.",
      },
      { status: 401, description: "No auth token was provided." },
      {
        status: 403,
        description:
          "This sign-in method may not be linked to an existing account.",
      },
    ],
  },
  {
    method: "GET",
    path: "/store/customers/me/password",
    tag: "Accounts",
    summary: "How the customer signs in",
    description:
      "Whether the account has a password (so the account page offers to change it, or to set one) and whether it signs in with Google.",
    auth: "customer",
    response: {
      description: "The sign-in methods.",
      schema: z.object({ has_password: z.boolean(), google: z.boolean() }),
    },
    errors: [{ status: 401, description: "No customer is logged in." }],
  },
  {
    method: "POST",
    path: "/store/customers/me/password/change",
    tag: "Accounts",
    summary: "Change the password",
    description:
      "Checks the current password, then sets the new one (8 to 128 characters). Every earlier sign-in to the account ends, this one included, so the response carries a fresh token to use from now on. Accounts without a password set one with POST /store/customers/me/password instead. Rate limited to 5 a minute.",
    auth: "customer",
    body: StoreChangePassword,
    response: {
      description: "Changed, with a fresh token.",
      schema: z.object({ changed: z.literal(true), token: z.string() }),
    },
    errors: [
      {
        status: 400,
        description:
          "The current password is wrong, the new one is too short, or the account has no password.",
      },
      { status: 401, description: "No customer is logged in." },
      { status: 429, description: "Too many requests." },
    ],
  },
  {
    method: "DELETE",
    path: "/store/customers/me/sessions",
    tag: "Accounts",
    summary: "Sign out of all devices",
    description:
      "Ends every sign-in to the account, this one included: tokens issued until now are refused. Resetting or changing the password does the same.",
    auth: "customer",
    response: {
      description: "Signed out everywhere.",
      schema: z.object({ signed_out: z.literal(true) }),
    },
    errors: [{ status: 401, description: "No customer is logged in." }],
  },
  {
    method: "POST",
    path: "/store/customers/me/password",
    tag: "Accounts",
    summary: "Set a password on an account that has none",
    description:
      "For customers who signed up with Google and want to sign in with a password too. The email is taken from the logged-in account, not the request. Refused when the account already has a password — that is a reset, not a set.",
    auth: "customer",
    body: StoreSetCustomerPassword,
    response: {
      description: "The password was set.",
      schema: z.object({ success: z.boolean() }),
    },
    errors: [
      {
        status: 400,
        description: "The password is shorter than 8 characters.",
      },
      { status: 401, description: "No customer is logged in." },
      {
        status: 403,
        description:
          "This account already has a password; use the reset flow instead.",
      },
    ],
  },
  {
    method: "GET",
    path: "/store/customers/me/wishlist",
    tag: "Wishlist",
    summary: "Get the customer's wishlist",
    description:
      "IDs only: load product details through /store/products so region pricing and publish status apply. Returns an empty list before the customer's first save.",
    auth: "customer",
    response: {
      description: "The wishlist.",
      schema: z.object({ wishlist: Wishlist }),
    },
    errors: [{ status: 401, description: "No customer is logged in." }],
  },
  {
    method: "POST",
    path: "/store/customers/me/wishlist/items",
    tag: "Wishlist",
    summary: "Save a product to the wishlist",
    description:
      "One entry per product. Saving a product that is already saved does nothing, except that `variant_id` replaces the variant stored before, so the entry follows the customer's latest colour/size choice.",
    auth: "customer",
    body: StoreAddWishlistItem,
    response: {
      description: "The updated wishlist.",
      schema: z.object({ wishlist: Wishlist }),
    },
    errors: [
      {
        status: 400,
        description:
          "Validation failed, or the variant is not part of the product.",
      },
      { status: 401, description: "No customer is logged in." },
      { status: 404, description: "No such published product." },
    ],
  },
  {
    method: "DELETE",
    path: "/store/customers/me/wishlist/items/{id}",
    tag: "Wishlist",
    summary: "Remove an item from the wishlist",
    auth: "customer",
    response: {
      description: "The updated wishlist.",
      schema: z.object({ wishlist: Wishlist }),
    },
    errors: [
      { status: 401, description: "No customer is logged in." },
      {
        status: 404,
        description:
          "No such item on this customer's wishlist. An item on any other list reads as not found, so item IDs cannot be probed.",
      },
    ],
  },
  {
    method: "POST",
    path: "/store/customers/me/wishlist/merge",
    tag: "Wishlist",
    summary: "Merge a guest wishlist into the customer's",
    description:
      "Call right after sign-in. Products only on the guest list are added; where both lists hold a product the customer's entry stays, taking the guest's colour/size only if it had none. The guest list is then deleted, so its ID stops working.",
    auth: "customer",
    body: StoreMergeWishlist,
    response: {
      description: "The customer's wishlist after the merge.",
      schema: z.object({ wishlist: Wishlist }),
    },
    errors: [
      { status: 401, description: "No customer is logged in." },
      {
        status: 404,
        description:
          "No such guest wishlist: never created, already merged, cleaned up, or it belongs to a customer.",
      },
    ],
  },
  {
    method: "POST",
    path: "/store/wishlists",
    tag: "Wishlist",
    summary: "Start a guest wishlist",
    description:
      "Creates a guest wishlist holding its first item; there is no way to create an empty one. Keep the returned ID private (an httpOnly cookie): anyone holding it can read and change the list. Guest lists with no saves for 90 days are deleted.",
    auth: "public",
    body: StoreAddWishlistItem,
    response: {
      description: "The new wishlist.",
      schema: z.object({ wishlist: Wishlist }),
    },
    errors: [
      {
        status: 400,
        description:
          "Validation failed, or the variant is not part of the product.",
      },
      { status: 404, description: "No such published product." },
    ],
  },
  {
    method: "GET",
    path: "/store/wishlists/{id}",
    tag: "Wishlist",
    summary: "Get a guest wishlist",
    description:
      "IDs only, as for the customer's wishlist. A customer's list reads as not found.",
    auth: "public",
    response: {
      description: "The wishlist.",
      schema: z.object({ wishlist: Wishlist }),
    },
    errors: [
      {
        status: 404,
        description:
          "No such guest wishlist: never created, merged at sign-in, cleaned up, or it belongs to a customer.",
      },
    ],
  },
  {
    method: "POST",
    path: "/store/wishlists/{id}/items",
    tag: "Wishlist",
    summary: "Save a product to a guest wishlist",
    description: "Same one-entry-per-product rules as the customer's wishlist.",
    auth: "public",
    body: StoreAddWishlistItem,
    response: {
      description: "The updated wishlist.",
      schema: z.object({ wishlist: Wishlist }),
    },
    errors: [
      {
        status: 400,
        description:
          "Validation failed, or the variant is not part of the product.",
      },
      {
        status: 404,
        description: "No such guest wishlist, or no such published product.",
      },
    ],
  },
  {
    method: "DELETE",
    path: "/store/wishlists/{id}/items/{item_id}",
    tag: "Wishlist",
    summary: "Remove an item from a guest wishlist",
    auth: "public",
    response: {
      description: "The updated wishlist.",
      schema: z.object({ wishlist: Wishlist }),
    },
    errors: [
      {
        status: 404,
        description:
          "No such guest wishlist, or no such item on it. An item on any other list reads as not found.",
      },
    ],
  },
  {
    method: "GET",
    path: "/store/catalog",
    tag: "Search",
    summary: "A listing page's products, filters and counts",
    description:
      "For category, collection, new-arrivals and search pages. `q` narrows the listing to products matching a search term (typo tolerant, within any category or collection given), and `recommended` then means relevance; a first request for a term (no filters, offset 0, default sort) counts towards trending searches. Pass at most one of `category` (a handle; its subcategories' products are included) or `collection` (a handle); neither lists the whole catalogue. Repeat a filter to allow several values (`colour=Black&colour=Navy`): values within a filter are alternatives, filters combine. Each facet counts products against the other filters, so ticking a second value shows what it adds. `fit` lists only short labels from `metadata.fit`. Sorts: `recommended` (buyable first, then newest), `newest`, `price_asc`, `price_desc` (cheapest variant in the region). Results reuse the listing's products for 60 seconds. Rate limited to 240 a minute.",
    auth: "public",
    query: [
      {
        name: "region_id",
        description: "Prices and sorting use this region.",
        schema: z.string(),
      },
      {
        name: "q",
        description: "A search term, up to 128 characters.",
        schema: z.string(),
      },
      {
        name: "category",
        description: "A category handle.",
        schema: z.string(),
      },
      {
        name: "collection",
        description: "A collection handle.",
        schema: z.string(),
      },
      {
        name: "sort",
        description: "recommended, newest, price_asc or price_desc.",
        schema: z.string(),
      },
      { name: "offset", description: "Products to skip.", schema: z.number() },
      {
        name: "limit",
        description: "Products per page, 1 to 100 (24).",
        schema: z.number(),
      },
      {
        name: "type",
        description: "Product type, repeatable.",
        schema: z.string(),
      },
      {
        name: "colour",
        description: "Colour option value, repeatable.",
        schema: z.string(),
      },
      {
        name: "size",
        description: "Size option value, repeatable.",
        schema: z.string(),
      },
      {
        name: "material",
        description: "Product material, repeatable.",
        schema: z.string(),
      },
      {
        name: "fit",
        description: "Fit label, repeatable.",
        schema: z.string(),
      },
      {
        name: "feature",
        description: "Product tag, repeatable.",
        schema: z.string(),
      },
    ],
    response: {
      description: "The page and its facets.",
      schema: CatalogListing,
    },
    errors: [
      { status: 400, description: "Invalid query, such as a missing region." },
      { status: 404, description: "No such category, collection or region." },
      { status: 429, description: "Too many requests." },
    ],
  },
  {
    method: "GET",
    path: "/store/search",
    tag: "Search",
    summary: "Search products",
    description:
      "Full-text search over published products in the sales channels the publishable key allows, with counted facets for refining the results. Returns the index' own fields rather than product rows: prices depend on region, currency and any active price list, so fetch /store/products with the returned ids to show them. Repeat a filter parameter to pass several values; values within one filter are OR-ed, and separate filters are AND-ed.",
    auth: "public",
    query: [
      {
        name: "q",
        description:
          "The text to match, against title, subtitle, description, type, collection and categories. Omit it to browse the facets alone.",
        schema: z.string().optional(),
      },
      {
        name: "limit",
        description: "Page size, 1 to 50 (default 24).",
        schema: z.coerce.number().optional(),
      },
      {
        name: "offset",
        description: "Records to skip (default 0).",
        schema: z.coerce.number().optional(),
      },
      {
        name: "category",
        description: "Filter by category handle. Repeatable.",
        schema: z.union([z.string(), z.array(z.string())]).optional(),
      },
      {
        name: "type",
        description: "Filter by product type. Repeatable.",
        schema: z.union([z.string(), z.array(z.string())]).optional(),
      },
      {
        name: "collection",
        description: "Filter by collection handle. Repeatable.",
        schema: z.union([z.string(), z.array(z.string())]).optional(),
      },
      {
        name: "tag",
        description: "Filter by tag value. Repeatable.",
        schema: z.union([z.string(), z.array(z.string())]).optional(),
      },
    ],
    response: {
      description: "Matching products, with facet counts.",
      schema: SearchResult,
    },
    errors: [
      {
        status: 400,
        description:
          "Validation failed, the publishable key is missing, or the Search Module is not configured on this backend.",
      },
    ],
  },
  {
    method: "GET",
    path: "/store/search/trending",
    tag: "Search",
    summary: "Read trending search terms",
    auth: "public",
    query: [
      {
        name: "limit",
        description: "Number of terms, 1 to 10 (default 6).",
        schema: z.coerce.number().int().min(1).max(10).optional(),
      },
    ],
    response: {
      description:
        "Reviewed phrases with at least five searches in seven days and current published product matches in the requesting sales channels. Empty when SEARCH_TRENDING_TERMS is unset. No shopper-entered terms outside that list are published.",
      schema: SearchTrending,
    },
  },
  {
    method: "GET",
    path: "/store/search/suggestions",
    tag: "Search",
    summary: "Suggest products, categories and collections",
    auth: "public",
    query: [
      {
        name: "q",
        description: "Search text, 2 to 64 characters.",
        schema: z.string().min(2).max(64),
      },
      {
        name: "limit",
        description: "Product limit, 1 to 10 (default 6).",
        schema: z.coerce.number().int().min(1).max(10).optional(),
      },
    ],
    response: {
      description: "Matching products and taxonomy.",
      schema: SearchSuggestions,
    },
  },
  {
    method: "POST",
    path: "/webhooks/resend",
    tag: "Newsletter",
    summary: "Receive signed Resend consent, suppression and delivery events",
    description:
      "Requires svix-id, svix-timestamp, and svix-signature computed over the original request bytes. No publishable key or customer session is used. Supports contact.updated opt-outs, permanent email.bounced, email.complained, email.suppressed and suppression.added for consent. email.delivered, email.delivery_delayed, email.bounced, email.complained, email.suppressed and email.failed are also recorded against the sent email for the admin's order and customer pages. Other events are acknowledged without changes. Delivery limit: 64 KiB.",
    auth: "webhook",
    body: z.object({
      type: z.string(),
      created_at: z.string(),
      data: z.record(z.string(), z.unknown()),
    }),
    response: {
      description: "Acknowledged after workflow handling; duplicates are safe.",
      schema: z.object({ received: z.literal(true) }),
    },
    errors: [
      {
        status: 400,
        description: "Invalid signature, delivery timestamp or event body.",
      },
      { status: 503, description: "Signing secret is not configured." },
      {
        status: 500,
        description:
          "Processing failed. Retry the delivery; pending receipts are also recovered by a scheduled job.",
      },
    ],
  },
  {
    method: "GET",
    path: "/admin/content-pages",
    tag: "Storefront",
    summary: "Get the About, Privacy and Terms page text",
    description:
      "Plain text: paragraphs separated by a blank line, `## ` starting a heading, `- ` a bullet point. Null when not written.",
    auth: "admin",
    policies: ["storefront_settings:read"],
    response: {
      description: "Each page's text.",
      schema: z.object({
        pages: z.object({
          about: z.string().nullable(),
          privacy: z.string().nullable(),
          terms: z.string().nullable(),
        }),
      }),
    },
  },
  {
    method: "POST",
    path: "/admin/content-pages",
    tag: "Storefront",
    summary: "Change the About, Privacy and Terms page text",
    description:
      "Pages left out keep their text. An empty string or null clears one, which also takes its link out of the footer. Up to 30,000 characters each.",
    auth: "admin",
    policies: ["storefront_settings:update"],
    body: AdminUpdateContentPages,
    response: {
      description: "Each page's text after the change.",
      schema: z.object({
        pages: z.object({
          about: z.string().nullable(),
          privacy: z.string().nullable(),
          terms: z.string().nullable(),
        }),
      }),
    },
  },
  {
    method: "GET",
    path: "/store/content-pages/{page}",
    tag: "Storefront",
    summary: "Get a page's text",
    description:
      "`page` is `about`, `privacy` or `terms`. 404 until it has text.",
    auth: "public",
    response: {
      description: "The page.",
      schema: z.object({
        page: z.object({
          name: z.enum(["about", "privacy", "terms"]),
          text: z.string(),
        }),
      }),
    },
    errors: [{ status: 404, description: "No such page, or not written yet." }],
  },
  {
    method: "GET",
    path: "/admin/support-info",
    tag: "Support",
    summary: "Get the contact details shown on the website",
    description:
      "Support hours, typical reply time, phone and WhatsApp numbers, and delivery information, as the contact and delivery pages show them. The support email itself is part of branding.",
    auth: "admin",
    policies: ["support_info:read"],
    response: {
      description: "The contact details; each null when not set.",
      schema: z.object({ support_info: SupportInfo }),
    },
  },
  {
    method: "POST",
    path: "/admin/support-info",
    tag: "Support",
    summary: "Change the contact details shown on the website",
    description:
      "Fields left out keep their value; an empty string or null clears one, and the website then leaves it out. Phone numbers are stored in international form with spaces and dashes removed.",
    auth: "admin",
    policies: ["support_info:update"],
    body: AdminUpdateSupportInfo,
    response: {
      description: "The contact details after the change.",
      schema: z.object({ support_info: SupportInfo }),
    },
    errors: [
      {
        status: 400,
        description:
          "Too long, or a phone number not in international form (+234...).",
      },
    ],
  },
  {
    method: "POST",
    path: "/store/contact",
    tag: "Support",
    summary: "Send a message from the contact page",
    description:
      "Creates a support request (see Support inbox) and emails it to the support address in branding, with the customer as reply-to, and acknowledges to the customer with its reference, the typical reply time and the link to follow it. Only the reference is returned: the link is emailed, so typing someone else's address never shows our replies to them. Signed in with the same email, the request also shows in the account. With an order number, the staff email says whether it belongs to an order placed with the same email. `website` must be left empty: it is hidden from people, and a filled one is answered as sent without sending anything. Rate limited to 5 a minute.",
    auth: "public",
    body: StoreContactMessage,
    response: {
      description:
        "Accepted, with the request's reference (null for a bot submission).",
      schema: z.object({
        sent: z.literal(true),
        reference: z.string().nullable(),
      }),
    },
    errors: [
      { status: 400, description: "A field is missing or invalid." },
      { status: 429, description: "Too many requests." },
    ],
  },
  {
    method: "GET",
    path: "/admin/return-policy",
    tag: "Returns",
    summary: "Get the return policy",
    auth: "admin",
    policies: ["return_policy:read"],
    response: {
      description: "Whether customers can request returns, and the window.",
      schema: z.object({ return_policy: ReturnPolicy }),
    },
  },
  {
    method: "POST",
    path: "/admin/return-policy",
    tag: "Returns",
    summary: "Change the return policy",
    description:
      "The window applies to every order at once, including ones already delivered.",
    auth: "admin",
    policies: ["return_policy:update"],
    body: AdminUpdateReturnPolicy,
    response: {
      description: "The saved policy.",
      schema: z.object({ return_policy: ReturnPolicy }),
    },
  },
  {
    method: "POST",
    path: "/store/order-lookup",
    tag: "Returns",
    summary: "Find an order from its number and email",
    description:
      "For guests without their confirmation email. When the number and email match, the confirmation is emailed again with a fresh order link; nothing is opened here. The answer is the same whether or not they match. Rate limited to 10 attempts a minute, and 3 a minute per email.",
    auth: "public",
    body: StoreOrderLookup,
    response: {
      description: "Accepted; an email follows if the order exists.",
      schema: z.object({ sent: z.literal(true) }),
    },
    errors: [{ status: 429, description: "Too many attempts." }],
  },
  {
    method: "GET",
    path: "/store/carts/{id}/order-access",
    tag: "Returns",
    summary: "The order link's key for a completed cart",
    description:
      "For the browser that checked out: the key that opens the order the cart became, sent as `x-order-access` to GET /store/orders/{id} and the order's other routes. Medusa's GET /store/orders/{id} needs that key or the order's signed-in customer; the order ID alone answers 404. Keys last 60 days; every order email carries a fresh one. Rate limited to 30 a minute.",
    auth: "public",
    response: {
      description: "The order and its key.",
      schema: z.object({ order_id: z.string(), key: z.string() }),
    },
    errors: [
      { status: 404, description: "The cart hasn't become an order." },
      { status: 429, description: "Too many requests." },
    ],
  },
  {
    method: "GET",
    path: "/store/orders/{id}/return-options",
    tag: "Returns",
    summary: "What can still be returned from an order",
    description:
      "For the order's signed-in customer, or with the key from an order link in the `x-order-access` header, like GET /store/orders/{id}. Each item's `returnable_quantity` is what has been sent, minus what is already being returned, while its window is open.",
    auth: "public",
    response: { description: "The return options.", schema: ReturnOptions },
    errors: [{ status: 404, description: "No such order." }],
  },
  {
    method: "POST",
    path: "/store/orders/{id}/return-requests",
    tag: "Returns",
    summary: "Request a return",
    description:
      "Signed in, the order must be the customer's own. As a guest, `access` must be the token from the link emailed by POST /store/orders/{id}/return-access (knowing the order's email is not enough: anyone with the order's id can read it). Each item must still be returnable in the quantity asked for (see return-options). Reasons come from GET /store/return-reasons. Emails the customer that the request was received. Rate limited to 10 a minute.",
    auth: "public",
    body: StoreRequestReturn,
    response: {
      description: "The requested return.",
      schema: z.object({ return: z.object({ id: z.string() }) }),
    },
    errors: [
      {
        status: 400,
        description:
          "Validation failed; a reason doesn't exist; the access token is missing, expired or for another order, or the order isn't the signed-in customer's; or an item can't be returned (window closed, quantity too high, returns off). `message` says which, in words fit to show the customer.",
      },
      { status: 404, description: "No such order." },
      { status: 429, description: "Too many requests." },
    ],
  },
  {
    method: "POST",
    path: "/store/orders/{id}/return-access",
    tag: "Returns",
    summary: "Email a guest their return link",
    description:
      "Emails the order's own address (never one from the request) a link to /orders/{id}/return?access=<token> on the storefront, valid for 24 hours. The token is what a guest passes as `access` to request a return. Rate limited to 5 a minute.",
    auth: "public",
    response: {
      description: "Where it went, partly hidden: `j•••@example.com`.",
      schema: z.object({ sent_to: z.string() }),
    },
    errors: [
      { status: 400, description: "The order has no email address." },
      { status: 404, description: "No such order." },
      { status: 429, description: "Too many requests." },
    ],
  },
  {
    method: "POST",
    path: "/admin/orders/{id}/credo-refunds",
    tag: "Support",
    summary: "Record a refund made in the Credo dashboard",
    description:
      "Credo has no refund API, so staff refund in its dashboard and record it here. Runs Medusa's refund for exactly that amount on the order's Credo payment, without calling Credo: the refund is attributed to the caller with the Credo reference in its note, the order's balance updates, and the customer gets the refund email. Medusa's checks apply, so it can't exceed what was captured. The ordinary refund route keeps refusing Credo payments. A gateway reference can be recorded only once; duplicate or uncertain attempts require reconciliation.",
    auth: "admin",
    policies: ["refund:create"],
    body: AdminRecordCredoRefund,
    response: {
      description: "Recorded.",
      schema: z.object({ recorded: z.literal(true) }),
    },
    errors: [
      {
        status: 409,
        description:
          "This gateway refund is already recorded or awaiting reconciliation.",
      },
      {
        status: 400,
        description:
          "Not a Credo payment, or more than what is left to refund.",
      },
      {
        status: 404,
        description: "No such order, or the payment isn't on it.",
      },
    ],
  },
  {
    method: "POST",
    path: "/admin/orders/{id}/paystack-refunds",
    tag: "Support",
    summary: "Record a completed Paystack refund",
    description:
      "Enter the numeric refund ID from Paystack after it reaches processed status. Verifies its transaction, amount and currency against Paystack before recording it and notifying the customer. Gateway references can be recorded only once, including concurrent requests. This endpoint never sends money. Initiate refunds in the Paystack dashboard.",
    auth: "admin",
    policies: ["refund:create"],
    body: AdminRecordPaystackRefund,
    response: {
      description: "Recorded.",
      schema: z.object({ recorded: z.literal(true) }),
    },
    errors: [
      {
        status: 409,
        description:
          "This gateway refund is already recorded or awaiting reconciliation.",
      },
      {
        status: 400,
        description:
          "The refund is incomplete, belongs to another transaction, or its amount or currency does not match.",
      },
      {
        status: 404,
        description: "No such order, or the payment isn't on it.",
      },
    ],
  },
  {
    method: "POST",
    path: "/store/orders/{id}/help",
    tag: "Support",
    summary: "Ask for help with an order",
    description:
      "`kind`: order (a question), cancel, change_address, exchange, damaged or missing. Creates a support request linked to the order; replies always go to the order's own email, and only the reference comes back here (the link to follow it is emailed), so someone who merely has the order's link can't read the answers. Needs the order's signed-in customer or an order link's key in `x-order-access`. Up to 3 photos as base64 (JPEG, PNG or WebP, checked by their bytes, 3 MB each). Rate limited to 5 a minute.",
    auth: "public",
    body: StoreOrderHelp,
    response: {
      description:
        "The request's reference and where the confirmation went, partly hidden.",
      schema: z.object({ reference: z.string(), sent_to: z.string() }),
    },
    errors: [
      {
        status: 400,
        description: "Invalid input or photo, or the order has no email.",
      },
      { status: 404, description: "No such order." },
      { status: 429, description: "Too many requests." },
    ],
  },
  {
    method: "GET",
    path: "/store/support-requests",
    tag: "Support",
    summary: "The customer's support requests",
    description:
      "Requests made while signed in with the account's email, and guest ones from the same email once it is verified. Latest activity first.",
    auth: "customer",
    response: {
      description: "The requests.",
      schema: z.object({ requests: z.array(PublicSupportRequest) }),
    },
  },
  {
    method: "GET",
    path: "/store/support-requests/{id}",
    tag: "Support",
    summary: "A support request and its conversation",
    description:
      "For the signed-in customer it belongs to, or with `access`, the key from the request's email link. Staff notes are never included. Anything else is a 404.",
    auth: "public",
    query: [
      {
        name: "access",
        description: "The key from the email link.",
        schema: z.string(),
      },
    ],
    response: {
      description: "The request.",
      schema: z.object({
        request: PublicSupportRequest.extend({
          messages: z.array(PublicSupportMessage),
        }),
      }),
    },
    errors: [{ status: 404, description: "Not found, or not yours." }],
  },
  {
    method: "POST",
    path: "/store/support-requests/{id}/messages",
    tag: "Support",
    summary: "Reply on a support request",
    description:
      "As its owner or with `access`. Reopens the request and emails the support inbox. Up to 3 photos. Rate limited to 10 a minute.",
    auth: "public",
    body: StoreSupportReply,
    response: {
      description: "The conversation after the reply.",
      schema: z.object({ messages: z.array(PublicSupportMessage) }),
    },
    errors: [
      { status: 400, description: "Invalid input or photo." },
      { status: 404, description: "Not found, or not yours." },
    ],
  },
  {
    method: "GET",
    path: "/store/support-requests/{id}/photos/{message_id}/{index}",
    tag: "Support",
    summary: "A photo from a support conversation",
    description:
      "The image itself, for the request's signed-in customer or with `access`. Photos are kept in a private bucket and only served this way; the `url` of a message's photo points here. Never cached beyond the browser. Rate limited to 120 a minute.",
    auth: "public",
    query: [
      {
        name: "access",
        description: "The key from the email link.",
        schema: z.string(),
      },
    ],
    response: {
      description: "A JPEG, PNG or WebP image.",
      schema: z.unknown(),
    },
    errors: [{ status: 404, description: "Not found, or not yours." }],
  },
  {
    method: "POST",
    path: "/store/support-requests/{id}/access-link",
    tag: "Support",
    summary: "Email a fresh link to a request",
    description:
      "For a customer whose emailed link expired (links last 90 days) or was cancelled by staff. The link goes only to the request's own email; the answer is the same whether or not the request exists. Rate limited to 5 a minute.",
    auth: "public",
    response: {
      description: "Accepted.",
      schema: z.object({ sent: z.literal(true) }),
    },
    errors: [{ status: 429, description: "Too many requests." }],
  },
  {
    method: "GET",
    path: "/admin/support-requests",
    tag: "Support",
    summary: "Support inbox",
    description:
      "Requests, latest activity first. Filter by `status`, `assigned_to` (a user id, or `me`) and `q` (reference, email or name). `counts` gives how many are in each status.",
    auth: "admin",
    policies: ["support_request:read"],
    query: [
      {
        name: "status",
        description: "open, awaiting_customer or resolved.",
        schema: z.string(),
      },
      {
        name: "assigned_to",
        description: "A user id, or me.",
        schema: z.string(),
      },
      {
        name: "q",
        description: "Reference, email or name.",
        schema: z.string(),
      },
      { name: "offset", description: "Requests to skip.", schema: z.number() },
      {
        name: "limit",
        description: "Up to 100; 50 by default.",
        schema: z.number(),
      },
    ],
    response: {
      description: "A page of requests.",
      schema: z.object({
        requests: z.array(z.record(z.string(), z.unknown())),
        count: z.number(),
        offset: z.number(),
        limit: z.number(),
        counts: z.object({
          open: z.number(),
          awaiting_customer: z.number(),
          resolved: z.number(),
        }),
      }),
    },
  },
  {
    method: "GET",
    path: "/admin/support-requests/{id}",
    tag: "Support",
    summary: "A support request",
    description: "With every message, staff notes included.",
    auth: "admin",
    policies: ["support_request:read"],
    response: {
      description: "The request.",
      schema: z.object({ request: z.record(z.string(), z.unknown()) }),
    },
    errors: [{ status: 404, description: "No such request." }],
  },
  {
    method: "POST",
    path: "/admin/support-requests/{id}",
    tag: "Support",
    summary: "Change a support request's status, priority or assignee",
    description: "`assigned_to` null unassigns.",
    auth: "admin",
    policies: ["support_request:update"],
    body: AdminUpdateSupportRequest,
    response: {
      description: "The request after the change.",
      schema: z.object({ request: z.record(z.string(), z.unknown()) }),
    },
  },
  {
    method: "GET",
    path: "/admin/support-requests/{id}/photos/{message_id}/{index}",
    tag: "Support",
    summary: "A photo from a support conversation",
    description:
      "The image itself, for staff who can read support requests. The `url` of a message's photo in GET /admin/support-requests/{id} points here.",
    auth: "admin",
    policies: ["support_request:read"],
    response: {
      description: "A JPEG, PNG or WebP image.",
      schema: z.unknown(),
    },
    errors: [{ status: 404, description: "No such photo." }],
  },
  {
    method: "POST",
    path: "/admin/support-requests/{id}/revoke-links",
    tag: "Support",
    summary: "Cancel the customer's emailed links",
    description:
      "Every link to the request emailed so far stops working, for a link that was forwarded or leaked. The signed-in owner keeps access, and the next email to the customer carries a new link.",
    auth: "admin",
    policies: ["support_request:update"],
    response: {
      description: "The request.",
      schema: z.object({ request: z.record(z.string(), z.unknown()) }),
    },
  },
  {
    method: "POST",
    path: "/admin/support-requests/{id}/messages",
    tag: "Support",
    summary: "Reply to a support request, or add a staff note",
    description:
      "A reply is emailed to the customer with a link to the conversation and moves the request to awaiting_customer. With `internal`, it is a note only staff see, and nobody is emailed.",
    auth: "admin",
    policies: ["support_request:update"],
    body: AdminSupportReply,
    response: {
      description: "The new message's id.",
      schema: z.object({ message_id: z.string() }),
    },
  },
  {
    method: "GET",
    path: "/admin/attention",
    tag: "Support",
    summary: "What is waiting on a person",
    description:
      "`payments`: Paystack and Credo payment attempts whose bag never became an order, as the reconciliation job last found them. It runs every five minutes, tracks every attempt at least 20 minutes old (not only each bag's newest), and rechecks unfinished ones on a backoff: `paid_no_order`, `amount_mismatch`, `pending` (still being rechecked) or `stale` (unfinished or uncheckable for a week). Failed attempts and ones that became orders drop off. Up to 100, newest first; `payments_count` is the total. `support_open`: support requests waiting on staff. `emails_to_review`: how many sends await review. `returns`: requested returns not received after three days. `unshipped`: paid, uncanceled orders from the last 60 days with nothing shipped after three days. Up to 50 of each, oldest first.",
    auth: "admin",
    policies: ["order:read"],
    response: {
      description: "The queue.",
      schema: z.object({
        support_open: z.number(),
        emails_to_review: z.number(),
        payments: z.array(
          z.object({
            id: z.string(),
            session_id: z.string(),
            reference: z.string().nullable(),
            provider_id: z.string(),
            amount: z.number(),
            currency_code: z.string(),
            email: z.string().nullable(),
            created_at: z.string(),
            verdict: z.enum([
              "paid_no_order",
              "amount_mismatch",
              "pending",
              "stale",
            ]),
          }),
        ),
        payments_count: z.number(),
        returns: z.array(
          z.object({
            id: z.string(),
            order_id: z.string(),
            display_id: z.number(),
            requested_at: z.string(),
          }),
        ),
        unshipped: z.array(
          z.object({
            id: z.string(),
            display_id: z.number(),
            email: z.string().nullable(),
            created_at: z.string(),
          }),
        ),
      }),
    },
  },
  {
    method: "POST",
    path: "/admin/payment-checks/{id}/resolve",
    tag: "Support",
    summary: "Mark a flagged payment handled",
    description:
      "For a payment in Needs attention that staff dealt with outside the store, such as a refund in the gateway's dashboard. The note says what was done and is kept with who did it. An attempt that becomes an order clears itself.",
    auth: "admin",
    policies: ["order:update"],
    body: AdminResolvePaymentCheck,
    response: {
      description: "The payment check.",
      schema: z.object({ payment_check: z.record(z.string(), z.unknown()) }),
    },
    errors: [{ status: 404, description: "No such payment check." }],
  },
  {
    method: "GET",
    path: "/admin/email-review",
    tag: "Support",
    summary: "Emails whose outcome is unknown",
    description:
      "Up to 100 unresolved sends, oldest first: `needs_review` (sending stopped because the outcome is uncertain) and `stalled` (attempted over 23 hours ago with no answer). Template, recipient and resource come from the notification that sent each one; they are null if it can't be matched. `count` is the total.",
    auth: "admin",
    policies: ["order:read"],
    response: {
      description: "The sends to check.",
      schema: z.object({
        count: z.number(),
        deliveries: z.array(
          z.object({
            id: z.string(),
            state: z.enum(["needs_review", "stalled"]),
            attempts: z.number(),
            first_attempt_at: z.string().nullable(),
            template: z.string().nullable(),
            to: z.string().nullable(),
            resource_type: z.string().nullable(),
            resource_id: z.string().nullable(),
          }),
        ),
      }),
    },
  },
  {
    method: "POST",
    path: "/admin/email-review/{id}/resolve",
    tag: "Support",
    summary: "Record what happened to an uncertain send",
    description:
      "`sent`, with the email's ID from Resend's dashboard as evidence, marks it accepted. `not_sent` records the verdict but keeps it blocked, so the stored email can never go out late; a replacement is a new email (for example Resend on the order page). Records who decided and when.",
    auth: "admin",
    policies: ["order:update"],
    body: AdminResolveEmailDelivery,
    response: {
      description: "The verdict.",
      schema: z.object({
        delivery: z.object({
          id: z.string(),
          resolution: z.enum(["sent", "not_sent"]),
        }),
      }),
    },
    errors: [
      {
        status: 400,
        description:
          "No Resend email ID for `sent`, or the email isn't waiting for review.",
      },
      { status: 404, description: "No such delivery." },
    ],
  },
  {
    method: "GET",
    path: "/admin/payment-lookup",
    tag: "Support",
    summary: "Look up a payment",
    description:
      "Pass exactly one of `reference` or `email`. By reference (the one on the customer's Paystack or Credo receipt, or a payment session id): the payment, its cart and order, what the gateway says about it now, and a `verdict` -- `order_placed`, `paid_no_order` (create the order with POST /admin/payment-lookup/create-order), `amount_mismatch` (refund from the gateway's dashboard), `pending` (the gateway hasn't finished; it may still succeed), `not_paid` (failed or canceled) or `unknown` (the gateway couldn't be asked). By email: up to 20 recent payment attempts on carts with that email, without asking the gateway.",
    auth: "admin",
    policies: ["order:read"],
    query: [
      {
        name: "reference",
        description: "A payment reference or payment session id.",
        schema: z.string(),
      },
      {
        name: "email",
        description: "The customer's email, to list their recent attempts.",
        schema: z.string(),
      },
    ],
    response: {
      description: "The payment and verdict, or the attempts.",
      schema: z.union([
        z.object({
          attempt: PaymentAttempt,
          gateway: GatewayCheck,
          verdict: z.enum([
            "order_placed",
            "paid_no_order",
            "amount_mismatch",
            "pending",
            "not_paid",
            "unknown",
          ]),
        }),
        z.object({ attempts: z.array(PaymentAttempt) }),
      ]),
    },
    errors: [
      { status: 400, description: "Neither or both of reference and email." },
      { status: 404, description: "No payment has that reference." },
    ],
  },
  {
    method: "POST",
    path: "/admin/payment-lookup/create-order",
    tag: "Support",
    summary: "Create the order for a paid cart",
    description:
      "For a payment the gateway confirms but that has no order. Asks the gateway again, then completes the cart as the storefront would: payment verified, stock reserved, confirmation emailed. Refused unless the verdict is `paid_no_order`; fails without side effects if an item sold out meanwhile.",
    auth: "admin",
    policies: ["order:create"],
    body: AdminCreateOrderFromPayment,
    response: {
      description: "The new order.",
      schema: z.object({
        order: z.object({ id: z.string(), display_id: z.number() }),
      }),
    },
    errors: [
      {
        status: 400,
        description:
          "Not a paid cart without an order (the message says why), or the cart can't be completed (e.g. out of stock).",
      },
      { status: 404, description: "No such payment session." },
    ],
  },
  {
    method: "GET",
    path: "/admin/orders/{id}/emails",
    tag: "Support",
    summary: "Emails sent about an order",
    description:
      "Newest first, up to 50. One entry per email: retries are folded together. `outcome` comes from Resend's delivery webhooks (email.delivered, email.delivery_delayed, email.bounced, email.complained, email.suppressed, email.failed) and stays null until one arrives. Only emails sent after orders began being recorded on notifications are listed.",
    auth: "admin",
    policies: ["order:read"],
    response: {
      description: "The order's emails.",
      schema: z.object({ emails: z.array(EmailHistoryEntry) }),
    },
    errors: [{ status: 404, description: "No such order." }],
  },
  {
    method: "POST",
    path: "/admin/orders/{id}/emails/resend-confirmation",
    tag: "Support",
    summary: "Resend the order confirmation",
    description:
      "Sends the order confirmation again to the order's current email, as a new email. Each call sends once more, so the dashboard disables the button while a request is in flight.",
    auth: "admin",
    policies: ["order:update"],
    response: {
      description:
        "Where it was sent. `sent_to` is null when the order has no email, or when `pending` is true: the first attempt failed and the workflow engine is retrying.",
      schema: z.object({
        sent_to: z.string().nullable(),
        pending: z.boolean(),
      }),
    },
    errors: [{ status: 404, description: "No such order." }],
  },
  {
    method: "POST",
    path: "/admin/orders/{id}/emails/resend-shipping",
    tag: "Support",
    summary: "Resend a shipment's shipping email",
    description:
      "Sends the shipping email for one shipment of the order again, with its tracking details, to the order's current email, as a new email. Each call sends once more.",
    auth: "admin",
    policies: ["order:update"],
    body: AdminResendShippingEmail,
    response: {
      description:
        "Where it was sent. `sent_to` is null when the order has no email, or when `pending` is true: the first attempt failed and the workflow engine is retrying.",
      schema: z.object({
        sent_to: z.string().nullable(),
        pending: z.boolean(),
      }),
    },
    errors: [
      {
        status: 404,
        description: "No such order, or the shipment isn't part of it.",
      },
      {
        status: 400,
        description: "The fulfillment hasn't shipped or was canceled.",
      },
    ],
  },
  {
    method: "GET",
    path: "/admin/customers/{id}/support-context",
    tag: "Support",
    summary:
      "A customer's support requests, emails, saved items, alerts and cart reminders",
    description:
      "Up to `limit` of each (10 by default, up to 100), newest first, with totals. Emails are matched on the account's address, so they include emails sent before it existed. Alerts and cart reminders are matched on customer ID or address; the wishlist on the account only.",
    auth: "admin",
    policies: ["customer:read"],
    query: [
      {
        name: "limit",
        description: "Rows per section, 1 to 100; 10 by default.",
        schema: z.number(),
      },
    ],
    response: {
      description: "The customer's support context.",
      schema: CustomerSupportContext,
    },
    errors: [{ status: 404, description: "No such customer." }],
  },
  {
    method: "GET",
    path: "/health",
    tag: "Operations",
    summary: "Readiness check",
    description:
      "Replaces Medusa's built-in /health: probes the database and, when REDIS_URL is set, Redis, each with a 2-second timeout. The deploy gate, its rollback and the uptime probe read it. Never cached. A dependency this deployment does not use is `not_configured`.",
    auth: "public",
    response: {
      description: "Every configured dependency answered.",
      schema: z.object({
        status: z.enum(["ok", "unavailable"]),
        checks: z.record(z.string(), z.enum(["ok", "fail", "not_configured"])),
      }),
    },
    errors: [
      {
        status: 503,
        description:
          "A dependency failed or timed out; the body has the same shape with `status: unavailable`.",
      },
    ],
  },
  {
    method: "GET",
    path: "/health/operations",
    tag: "Operations",
    summary: "Background work check",
    description:
      "Whether background work is running: `worker` fails when the worker's once-a-minute heartbeat is over 5 minutes old, `payment_checks` when payment reconciliation has a check over 30 minutes overdue. The uptime probe reads it; the deploy gate does not, so a restarting worker can't fail a release. States only, never counts. Never cached.",
    auth: "public",
    response: {
      description: "Background work is running.",
      schema: z.object({
        status: z.enum(["ok", "unavailable"]),
        checks: z.record(z.string(), z.enum(["ok", "fail", "not_configured"])),
      }),
    },
    errors: [
      {
        status: 503,
        description:
          "The worker is quiet or checks are overdue; the body has the same shape with `status: unavailable`.",
      },
    ],
  },
  {
    method: "POST",
    path: "/auth/{actor_type}/{auth_provider}/update",
    tag: "Accounts",
    summary: "Finish a password reset",
    description:
      "Replaces Medusa's route of the same name. Send the reset token from the emailed link as `Authorization: Bearer <token>`; the token, not the body, says which account. Sets the new password (8 to 128 characters), then ends every earlier sign-in to the customer and admin accounts that use it, so tokens and admin sessions issued before now are refused. Rate limited to 10 a minute.",
    auth: "public",
    body: z.object({ password: z.string() }),
    response: {
      description: "Changed.",
      schema: z.object({ success: z.literal(true) }),
    },
    errors: [
      {
        status: 400,
        description: "The new password is shorter than 8 or longer than 128.",
      },
      {
        status: 401,
        description: "The reset token is missing, expired or already used.",
      },
      { status: 429, description: "Too many requests." },
    ],
  },
  {
    method: "GET",
    path: "/admin/custom",
    tag: "Scaffolding",
    summary: "Starter placeholder",
    description:
      "Returns 200 with no body. Left from the Medusa starter; safe to delete.",
    auth: "admin",
    response: { description: "Empty.", schema: z.object({}) },
  },
  {
    method: "GET",
    path: "/store/custom",
    tag: "Scaffolding",
    summary: "Starter placeholder",
    description:
      "Returns 200 with no body. Left from the Medusa starter; safe to delete.",
    auth: "public",
    response: { description: "Empty.", schema: z.object({}) },
  },
];
