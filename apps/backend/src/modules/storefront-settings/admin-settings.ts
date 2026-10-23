import { readAnnouncementBar } from "./announcements";
import { completeStoreMenuPromos } from "./store-menu-promos";
import { completeHomepageAbout } from "./homepage-about";

/** Keep admin responses consistent with the editable list contract. */
export function adminSettings<
  T extends {
    store_menu_cards: unknown;
    announcement_bar: unknown;
    homepage_about: unknown;
  },
>(settings: T) {
  return {
    ...settings,
    homepage_about: completeHomepageAbout(settings.homepage_about),
    store_menu_cards: completeStoreMenuPromos(settings.store_menu_cards),
    announcement_bar: readAnnouncementBar(settings.announcement_bar),
  };
}
