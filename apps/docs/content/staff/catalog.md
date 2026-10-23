---
title: Catalog, inventory and pricing
---

# Catalog, inventory and pricing

**Audience:** merchandising and Store Managers.

**Prerequisites:** the correct
sales channel, Nigeria region, NGN pricing, stock location and shipping profile.
Use the admin's supported product and inventory screens.

## Publish a product

1. Prepare its title, handle, description, categories and media. A collection is optional.
2. Define the actual sellable color/size variants and their identifiers.
3. Assign the correct images and size guide. Check mobile as well as desktop
   framing, legibility and color accuracy.
4. Set prices for the active currency and intended price lists. Confirm whether
   configured prices include tax; the storefront total must match that choice.
5. Link tracked variants to inventory and enter accurate stock at a location
   connected to the storefront's fulfillment setup.
6. Check shipping profile, publish the product and assign the storefront sales
   channel. Verify it through the customer journey before promotion.

## Price and promotion changes

Use price lists/promotions for deliberate campaigns. Check dates, currency,
eligibility, usage limits, minimum spend and stacking conditions. A percentage
label is not enough: test the resulting bag total and gateway amount with the
intended items and customer conditions.

Changing a catalog price does not rewrite historical order totals. If an old
price remains on a listing, verify cache refresh and region/price-list selection
before changing the price again.

## Inventory cases

| Case                              | Action                                                                                        |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| Physical count differs from admin | Investigate reservations, returns and location before making a documented adjustment          |
| Last unit is in two bags          | Only successful order completion should reserve/sell the available stock; test this race      |
| Backorders are requested          | Enable only with an approved fulfillment promise; do not use them to mask inaccurate stock    |
| Returned item can be resold       | Receive/inspect it through the return workflow and confirm the resulting location/stock       |
| Stock is at another location      | Use the supported inventory/fulfillment process; verify the sales channel can fulfill from it |

## Catalog presentation

Use the custom size-guide, coming-soon and product-alert controls where
appropriate. Category/collection assignments drive navigation and filters.
New-arrival badges depend on their configured age window. Approved search terms
and synonyms should represent the catalog without publishing customer searches.

### Create a collection

1. In **Products → Collections**, choose **Create** and enter the title. The
   handle becomes the storefront address `/collections/<handle>`; use a short
   lowercase handle such as `autumn-edit`.
2. Add products from the collection's **Products** section, or set
   **Collection** under **Organize** on each product. A product belongs to one
   collection at most.
3. In the collection's **Website content** box, add the description (shown on
   its page and the homepage), a landscape banner of at least 2400 × 1200px and
   optionally a portrait mobile banner of at least 1080 × 1350px. Without the
   mobile banner, phones crop the main banner.
4. Optionally feature it in **Settings → Storefront → Homepage**, or link it from
   a Store menu card in **Settings → Storefront → Navigation**.

**Result:** the collection appears in the Collections menu (a direct link when
it is the only one), on its own page and, if featured, on the homepage. A shared
link to it shows a preview card with its banner or first products.

**Recovery:** a collection with no published products shows an empty page; add
products or remove it from promotion. Deleting a collection keeps its products.

### Category boxes

Each category has three side boxes in the admin:

- **Home page picture:** the tile image in the homepage's "Shop by wardrobe"
  section, which shows the subcategories of each top-level category. Without
  one, the tile uses its newest product's photo.
- **Search & sharing:** the category's own search title and description.
- **Size guide:** the guide its products and subcategories inherit, unless a
  product sets its own.

### Selling without collections

Collections are optional. Products, categories, New arrivals, search, filters and
checkout continue to work without them. You do not need to create a placeholder
collection to launch the store.

- With no collections, the homepage collection section and collection navigation
  are hidden on desktop and mobile. Direct visits to `/collections` go to Products.
- One collection gets a direct navigation link; several get a Collections menu.
  A collection without a usable handle is omitted from links and cards.
- Deleted collection URLs show the normal not-found page. Removing all collections
  does not remove products, the homepage About section or newsletter signup.
- Hero and About buttons pointing to unavailable store collections are hidden;
  the surrounding copy and images remain visible.
- A collection with no products still exists. Its page can show an empty product
  list; add published products or remove the collection if it should not be promoted.

After creating or deleting collections, verify the storefront after its catalog
cache refreshes. Check the homepage, desktop menu, mobile menu, search and direct
collection links. Review manually written campaign links and copy as well.

## Verification and recovery

Open the product as a guest, select each variant, inspect media and guide, add
to the bag and check delivery eligibility. Test one invalid promotion and one
unavailable stock case. If publication breaks the store, unpublish the affected
product or revert the precise content change while preserving existing orders.
Escalate search-index or image-service failures to engineering.
