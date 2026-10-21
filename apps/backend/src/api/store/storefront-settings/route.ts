import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http";
import { ContainerRegistrationKeys } from "@medusajs/framework/utils";

import { googleSignInEnabled } from "../../../lib/environment-safety";
import { BRANDING_MODULE } from "../../../modules/branding";
import type BrandingModuleService from "../../../modules/branding/service";
import { STOREFRONT_SETTINGS_MODULE } from "../../../modules/storefront-settings";
import { completeHomepageHero } from "../../../modules/storefront-settings/homepage-hero";
import type StorefrontSettingsModuleService from "../../../modules/storefront-settings/service";
import { completeSupportInfo } from "../../../modules/storefront-settings/support-info";
import { completeContentPages } from "../../../modules/storefront-settings/content-pages";
import { completeSocialLinks } from "../../../modules/storefront-settings/social-networks";
import {
  completeStoreMenuPromos,
  type StoreMenuPromo,
} from "../../../modules/storefront-settings/store-menu-promos";

/**
 * Everything the storefront renders its shell and home page with: the brand,
 * the defaults for search results and link previews, the home page content,
 * and product display settings. Public and identical for every shopper, so
 * pages can read it and stay cached. Each field is listed explicitly, so a
 * setting added later is not exposed by accident.
 */
export const GET = async (req: MedusaRequest, res: MedusaResponse) => {
  const brandingService: BrandingModuleService =
    req.scope.resolve(BRANDING_MODULE);
  const settingsService: StorefrontSettingsModuleService = req.scope.resolve(
    STOREFRONT_SETTINGS_MODULE,
  );

  const [brand, settings] = await Promise.all([
    brandingService.retrieveSettings(),
    settingsService.retrieveSettings(),
  ]);

  res.json({
    settings: {
      brand: {
        name: brand.name,
        logo_url: brand.logo_url,
        favicon_url: brand.favicon_url,
        support_email: brand.support_email,
      },
      seo: {
        title: settings.seo_title,
        description: settings.seo_description,
        og_image_url: settings.og_image_url,
        twitter_handle: settings.twitter_handle,
        social_links: completeSocialLinks(
          settings.social_links as Record<string, unknown>,
        ),
        allow_indexing: settings.allow_indexing,
        google_site_verification: settings.google_site_verification,
      },
      homepage: {
        hero: completeHomepageHero(
          settings.homepage_hero as Record<string, unknown>,
        ),
        featured_collection_id: await existingCollectionId(
          req,
          settings.featured_collection_id,
        ),
      },
      products: {
        new_badge_days: settings.new_badge_days,
      },
      returns: {
        enabled: settings.returns_enabled,
        window_days: settings.return_window_days,
      },
      sign_in: {
        google: googleSignInEnabled(process.env),
      },
      support: completeSupportInfo(settings.support_info),
      // Which pages have text, for the footer; the text is fetched per page.
      pages: Object.fromEntries(
        Object.entries(completeContentPages(settings.content_pages)).map(
          ([page, text]) => [page, Boolean(text)],
        ),
      ),
      navigation: {
        store_menu_cards: await resolveStoreMenuPromos(
          req,
          completeStoreMenuPromos(settings.store_menu_cards),
        ),
      },
    },
  });
};

/**
 * The featured collection's id, or null once that collection has been
 * deleted, so the storefront never asks for a collection that 404s.
 */
async function existingCollectionId(
  req: MedusaRequest,
  id: string | null,
): Promise<string | null> {
  if (!id) {
    return null;
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);
  const { data } = await query.graph({
    entity: "product_collection",
    fields: ["id"],
    filters: { id },
  });

  return data.length ? id : null;
}

type ResolvedStoreMenuPromo = StoreMenuPromo & {
  title: string;
  href: string;
};

/**
 * URLs are derived from a live product, category, or collection handle. A
 * target deleted after an admin save is omitted instead of becoming a 404.
 */
async function resolveStoreMenuPromos(
  req: MedusaRequest,
  promos: StoreMenuPromo[],
): Promise<ResolvedStoreMenuPromo[]> {
  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY);

  return (
    await Promise.all(
      promos.map(async (promo): Promise<ResolvedStoreMenuPromo | null> => {
        const config = {
          collection: {
            entity: "product_collection",
            title: "title",
            path: "/collections/",
          },
          category: {
            entity: "product_category",
            title: "name",
            path: "/categories/",
          },
          product: {
            entity: "product",
            title: "title",
            path: "/products/",
          },
        } as const;
        const target = config[promo.target_type];
        const { data } = await query.graph({
          entity: target.entity,
          fields: [target.title, "handle"],
          filters: { id: promo.target_id },
        });
        const item = data[0] as Record<string, unknown> | undefined;
        const title = item?.[target.title];
        const handle = item?.handle;

        if (typeof title !== "string" || typeof handle !== "string") {
          return null;
        }

        return {
          ...promo,
          title,
          href: `${target.path}${encodeURIComponent(handle)}`,
        };
      }),
    )
  ).filter((promo): promo is ResolvedStoreMenuPromo => promo !== null);
}
