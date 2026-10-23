---
title: Browse, search and select
---

# Browse, search and select

**Audience:** support, merchandising and QA.

**Prerequisites:** published
products assigned to the storefront sales channel, NGN prices, configured
inventory and permitted image hosts.

## Normal journey

1. Open Products, a category, a collection or New arrivals.
2. Search or use the available filters and sort order. Open the product or
   quick view to inspect photos, description and available variants.
3. Choose the required color and size. Consult the product/category size guide
   when present; do not infer garment measurements from the label alone.
4. Check availability and price, then add the selection to the bag.

The bag must contain the selected variant, quantity and current calculated
price. Product cards, quick view and the full product page should agree.

Collections are optional. When none are configured, collection sections and menu
links are hidden; Products, categories, New arrivals and search remain available.
A direct visit to `/collections` opens Products. An old link to a deleted
collection shows the normal not-found page.

## Empty or unexpected results

| Symptom                                    | Check                                                                 | Recovery                                                                      |
| ------------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| No search matches                          | Spelling, active filters, publication and channel assignment          | Clear filters; staff inspect search indexing and approved vocabulary          |
| Product appears in admin but not the store | Published status, sales channel, category/collection and region price | Correct the catalog settings; verify the storefront after refresh             |
| Wrong color photo or no image              | Variant/media assignment and image-host allowlist                     | Merchandising corrects media; developers inspect image configuration          |
| Price differs after adding to the bag      | Region, price lists, promotion conditions and cached catalog          | Treat the server-calculated bag as authoritative; investigate discrepancies   |
| Size cannot be selected                    | Variant exists, stock, inventory location and shipping profile        | Correct catalog/stock or offer an available alternative                       |
| Product is coming soon or sold out         | Release setting and actual variant stock                              | Offer its available alert subscription; do not promise a release/restock date |

Stock can change between viewing a page and paying. A successful add-to-bag is
not a guarantee that inventory will remain available until checkout completes.

## Staff verification

Reproduce with a fresh guest session and the intended country/region. Verify a
known product is discoverable through search and navigation, each variant maps
to the correct photos/price, and unavailable variants cannot be purchased.
Record the product/variant ID and symptom in a ticket; customer search phrases
should not be copied into general operational logs.

For fixes, use [catalog operations](/staff/catalog). Search-data handling is
documented in [search privacy](/reference/generated/search-privacy).
