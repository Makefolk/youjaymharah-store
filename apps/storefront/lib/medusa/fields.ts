/**
 * Store API `fields` for product cards. Kept apart from catalog.ts, which is
 * server-only, because listing pages also load cards in the browser.
 */

/**
 * Baseline card data: price, sale, stock, swatches, the New badge and product
 * gallery. The media preset adds variant thumbnails and gallery photos.
 */
export const PRODUCT_CARD_FIELDS = [
  "id",
  "title",
  "handle",
  "thumbnail",
  "*images",
  "created_at",
  "+metadata",
  "*options",
  "*variants.calculated_price",
  "+variants.inventory_quantity",
  "+variants.manage_inventory",
  "+variants.allow_backorder",
  "*variants.options",
].join(",")

/** Default listing fields for the swipe gallery and colour thumbnail jumps. */
export const PRODUCT_CARD_MEDIA_FIELDS = [
  PRODUCT_CARD_FIELDS,
  "*variants.images",
  "+variants.thumbnail",
].join(",")

