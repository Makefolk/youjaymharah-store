import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk";

import type {
  HomepageHeroType,
  SocialLinksType,
  StoreMenuPromoType,
} from "../../api/middlewares";
import { STOREFRONT_SETTINGS_MODULE } from "../../modules/storefront-settings";
import { completeHomepageHero } from "../../modules/storefront-settings/homepage-hero";
import {
  completeHomepageAbout,
  type HomepageAboutInput,
} from "../../modules/storefront-settings/homepage-about";
import { completeSocialLinks } from "../../modules/storefront-settings/social-networks";
import { completeStoreMenuPromos } from "../../modules/storefront-settings/store-menu-promos";
import { validateAnnouncementBar } from "../../modules/storefront-settings/announcement-resolver";
import type { AnnouncementBar } from "../../modules/storefront-settings/announcements";
import StorefrontSettingsModuleService, {
  STOREFRONT_SETTINGS_ID,
} from "../../modules/storefront-settings/service";

export type UpdateStorefrontSettingsInput = {
  new_badge_days?: number;
  seo_title?: string | null;
  seo_description?: string | null;
  og_image_url?: string | null;
  twitter_handle?: string | null;
  /** Replaces the stored links as a whole: a network left out is removed. */
  social_links?: SocialLinksType;
  allow_indexing?: boolean;
  google_site_verification?: string | null;
  /** Replaces the stored hero as a whole: a field left out is cleared. */
  homepage_hero?: HomepageHeroType;
  homepage_about?: HomepageAboutInput;
  featured_collection_id?: string | null;
  store_menu_cards?: StoreMenuPromoType[];
  announcement_bar?: AnnouncementBar;
};

export const updateStorefrontSettingsStep = createStep(
  "update-storefront-settings",
  async (input: UpdateStorefrontSettingsInput, { container }) => {
    const service: StorefrontSettingsModuleService = container.resolve(
      STOREFRONT_SETTINGS_MODULE,
    );

    // Reads through retrieveSettings so the row exists before the first edit.
    const previous = await service.retrieveSettings();

    const announcementBar =
      input.announcement_bar !== undefined
        ? await validateAnnouncementBar(container, input.announcement_bar)
        : undefined;

    const {
      social_links,
      homepage_hero,
      homepage_about,
      store_menu_cards,
      ...rest
    } = input;

    const [updated] = await service.updateStorefrontSettings([
      {
        id: STOREFRONT_SETTINGS_ID,
        ...rest,
        ...(announcementBar ? { announcement_bar: announcementBar } : {}),
        ...(social_links
          ? { social_links: completeSocialLinks(social_links) }
          : {}),
        ...(homepage_hero
          ? { homepage_hero: completeHomepageHero(homepage_hero) }
          : {}),
        ...(homepage_about
          ? { homepage_about: completeHomepageAbout(homepage_about) }
          : {}),
        ...(store_menu_cards
          ? { store_menu_cards: { items: store_menu_cards } }
          : {}),
      },
    ]);

    return new StepResponse(updated, {
      new_badge_days: previous.new_badge_days,
      seo_title: previous.seo_title,
      seo_description: previous.seo_description,
      og_image_url: previous.og_image_url,
      twitter_handle: previous.twitter_handle,
      social_links: completeSocialLinks(
        previous.social_links as Record<string, unknown>,
      ),
      allow_indexing: previous.allow_indexing,
      google_site_verification: previous.google_site_verification,
      homepage_hero: completeHomepageHero(
        previous.homepage_hero as Record<string, unknown>,
      ),
      homepage_about: completeHomepageAbout(previous.homepage_about),
      featured_collection_id: previous.featured_collection_id,
      store_menu_cards: completeStoreMenuPromos(previous.store_menu_cards),
      announcement_bar: previous.announcement_bar,
    });
  },
  async (previous, { container }) => {
    if (!previous) {
      return;
    }

    const service: StorefrontSettingsModuleService = container.resolve(
      STOREFRONT_SETTINGS_MODULE,
    );

    await service.updateStorefrontSettings([
      {
        id: STOREFRONT_SETTINGS_ID,
        ...previous,
        store_menu_cards: { items: previous.store_menu_cards },
      },
    ]);
  },
);
