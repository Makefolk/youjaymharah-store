import { model } from "@medusajs/framework/utils";
import { DEFAULT_HOMEPAGE_ABOUT } from "../homepage-about";

/**
 * Settings the storefront renders with. A singleton like branding: one row,
 * addressed by STOREFRONT_SETTINGS_ID, edited in the "Homepage", "Sharing &
 * search" and "Products" sections of Settings -> Storefront.
 *
 * Kept apart from branding on purpose: branding is store identity and
 * owner-only, while these are day-to-day decisions for Marketing and the
 * Store Manager. The return policy fields are the exception: they have their
 * own permission (`return_policy`) and admin routes, so Marketing's access to
 * the rest does not extend to them.
 */
export const StorefrontSettings = model.define("storefront_settings", {
  id: model.id().primaryKey(),
  /** How many days a product shows the "New" badge after it goes on sale. */
  new_badge_days: model.number().default(30),
  /** The home page title; pages without their own title fall back to it. */
  seo_title: model.text().nullable(),
  /** The default description shown in search results and link previews. */
  seo_description: model.text().nullable(),
  /** The default link preview image (Open Graph and X cards). */
  og_image_url: model.text().nullable(),
  /** The store's X username, for X cards. */
  twitter_handle: model.text().nullable(),
  /** Social profile URLs by network: instagram, facebook, tiktok, x, youtube, pinterest. */
  social_links: model.json().default({}),
  /** Off asks search engines not to index the store at all. */
  allow_indexing: model.boolean().default(true),
  /** Google Search Console's HTML tag verification code. */
  google_site_verification: model.text().nullable(),
  /**
   * The home page hero's content (see homepage-hero.ts). The storefront owns
   * the layout; staff only fill it in or turn it off.
   */
  homepage_hero: model.json().default({ enabled: false }),
  homepage_about: model.json().default(DEFAULT_HOMEPAGE_ABOUT),
  /**
   * The collection featured on the home page. Not a module link: a single
   * optional pointer on a singleton, and a deleted collection is simply
   * treated as none by the store route.
   */
  featured_collection_id: model.text().nullable(),
  /** Curated, typed destinations for the Store navigation megamenu. */
  store_menu_cards: model.json().default({ items: [] }),
  /** Ordered header announcements with individual schedules. */
  announcement_bar: model.json().default({
    enabled: false,
    appearance: "dark",
    dismissible: true,
    items: [],
  }),
  /** Off hides "Request a return" on the storefront; staff can still create returns. */
  returns_enabled: model.boolean().default(true),
  /** Days after delivery (or dispatch, when delivery wasn't recorded) a return can be requested. */
  return_window_days: model.number().default(7),
  /**
   * How customers reach the team, shown on the contact page: opening hours,
   * typical reply time, phone and WhatsApp, and delivery information. See
   * support-info.ts for the shape; missing keys read as not set.
   */
  support_info: model.json().default({}),
  /**
   * The text of the About and Privacy pages, written in the admin (see
   * content-pages.ts). A page with no text isn't linked from the footer.
   */
  content_pages: model.json().default({}),
});
