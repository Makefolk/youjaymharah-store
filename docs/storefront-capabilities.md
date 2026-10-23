# Storefront capabilities: what the admin and backend provide

A planning reference for the storefront (`apps/storefront`), organised by shopping
experience so each section maps to screens. For every capability it lists what
staff control in the admin, what the storefront reads, and how far along it is.

Backend: Medusa 2.19 (`apps/backend`). Related guides:

- `docs/storefront-build-order.md`: phased build plan and launch checklist
- `apps/storefront/DATA-LAYER.md`: data-layer recipes and file map
- `docs/store-manager-handbook.md`: what staff do in the admin
- `docs/api/openapi.json` and `packages/api-types`: custom route contracts

Medusa's built-in store routes are listed where the storefront needs them, not
exhaustively.

## Status key

| Status            | Meaning                                                       |
| ----------------- | ------------------------------------------------------------- |
| **Ready**         | API and storefront helpers exist; build the UI                |
| **Backend ready** | API exists; the storefront calls it directly (no helpers yet) |
| **To build**      | Storefront work on a known contract                           |
| **Not available** | No backend support yet                                        |

---

## Ground rules

- **One region: Nigeria.** Prices in NGN (USD exists as a secondary currency).
  Pass `region_id` when fetching products, or no prices come back.
  `getStoreRegion()` returns the region.
- **Prices arrive as-is.** ₦45,000 comes back as `45000`. Never divide by 100.
  Whether VAT is included is a store setting, so display the numbers the API
  returns rather than adding tax yourself.
- **The browser never calls Medusa directly.** Client components go through the
  storefront's `/api/medusa` proxy, which adds the customer's token from an
  httpOnly cookie. Server Components call Medusa directly.
- **Catalogue pages stay cached.** Reading cookies makes a page render per
  visit. Render personal bits (wishlist heart, "Hi, Ada") from client
  components.
- **Translations are switched on.** Staff can translate content in the admin;
  store routes return translations when a request carries `x-medusa-locale`.
  Include the locale in any cache key for text.
- **Staff changes take up to 5 minutes to appear.** Storefront settings are
  cached for 5 minutes. The backend can refresh the storefront instantly once
  the storefront's `/api/revalidate` route exists (see Search engines &
  sharing).

---

## What staff set in Settings › Storefront

One public call, `GET /store/storefront-settings`, returns all of this. Read it
with `getStorefrontSettings()` (`lib/medusa/storefront-settings.ts`), which
falls back to defaults if the backend is unreachable.

Response shape:

```json
{
  "settings": {
    "brand": {
      "name": "",
      "logo_url": null,
      "favicon_url": null,
      "support_email": null
    },
    "seo": {
      "title": null,
      "description": null,
      "og_image_url": null,
      "twitter_handle": null,
      "social_links": {
        "instagram": null,
        "facebook": null,
        "tiktok": null,
        "x": null,
        "youtube": null,
        "pinterest": null
      },
      "allow_indexing": true,
      "google_site_verification": null
    },
    "homepage": {
      "about": {
        "enabled": true,
        "eyebrow": "A little about us",
        "title": "Pieces you love.\nStyle that’s yours.",
        "description": "Editable starter introduction",
        "image_url": null,
        "image_alt": null,
        "cta_label": "Explore the collection",
        "cta_url": "/products"
      },
      "hero": {
        "enabled": false,
        "eyebrow": null,
        "title": null,
        "description": null,
        "desktop_image_url": null,
        "mobile_image_url": null,
        "desktop_video_url": null,
        "mobile_video_url": null,
        "cta_label": null,
        "cta_url": null
      },
      "featured_collection_id": null
    },
    "products": { "new_badge_days": 30 }
  }
}
```

Every key is always present. Fields staff haven't filled in are `null`.

### Brand: Ready

Store name, logo, browser icon (favicon) and support email, for the header,
footer and contact details.

- **Admin:** Brand section, store owner only
- **Storefront reads:** `settings.brand.name`, `logo_url`, `favicon_url`,
  `support_email`

### Homepage hero: Ready

One banner at the top of the home page: eyebrow, headline, description, a photo
or a video (each with an optional mobile version), and an optional button. The
layout belongs to the storefront; staff only supply the content and can hide
the banner. There is one banner, not a carousel.

- **Admin:** Homepage section, Marketing or Store Manager
- **Storefront reads:** `settings.homepage.hero`
- **Render it only when `enabled` is true.** Text and images can stay saved
  while the banner is off, so staff can prepare one in advance.
- When `enabled` is true, `title` and `desktop_image_url` are guaranteed. Every
  other field may be null.
- `mobile_image_url` is optional. Fall back to the desktop image, cropped with
  `object-fit: cover`.
- **Photo or video:** a non-null `desktop_video_url` means a video hero.
  - Render `<video autoPlay muted loop playsInline>` with the matching image
    as `poster`. The images are still guaranteed, because they show while the
    video loads and when a phone blocks autoplay (for example iPhone Low Power
    Mode).
  - Under `prefers-reduced-motion: reduce`, show the poster image and don't
    autoplay.
  - Phones use `mobile_video_url` when it's set, otherwise the desktop video
    cropped with `object-fit: cover`. `mobile_video_url` is never set without
    a desktop video. Pick the source by screen width on the client:
    `<source media>` on `<video>` isn't supported everywhere.
  - Keep the video out of the Largest Contentful Paint path: the poster image
    paints first. Use `preload="metadata"` or the default.
- `cta_label` and `cta_url` are either both set or both null.
  `cta_url` is either a store path starting with `/` (use Next `<Link>`) or a
  full `http(s)://` address (use a plain `<a>`).

### Homepage About: Ready

An introduction near the bottom of the homepage, with a portrait image or a
brand panel using the admin-managed logo and name.

- **Admin:** Settings › Storefront › Homepage About, owner, Marketing or Store Manager.
  Support has read access only.
- **Storefront reads:** `settings.homepage.about`. Render only when `enabled`
  is true. A visible section requires a heading and introduction. Plain text is
  rendered safely; line breaks in the heading and paragraph breaks are preserved.
- **Admin writes:** `POST /admin/storefront-settings` with `homepage_about`.
  Sending this field replaces the entire section; omitted optional values are
  cleared. Sending other settings leaves it unchanged.
- An image is optional; when present it needs an `http(s)` URL and `image_alt`.
  Uploaded images use the existing file service and storefront image host configuration.
- `cta_label` and `cta_url` must be set together or both cleared. The destination
  is a store path or a full `http(s)` address, without embedded credentials.
- Starter content is seeded by the migration. The default link is `/products`;
  the standalone About page remains separately managed under Settings › Pages.

### Featured collection: Ready

One collection staff pick to feature on the home page.

- **Admin:** Homepage section (a list of collections)
- **Storefront reads:** `settings.homepage.featured_collection_id`, then
  `GET /store/collections/{id}` with `fields=+metadata` for its title, handle,
  `metadata.description`, `metadata.hero_image` and
  `metadata.hero_image_mobile`. List its products with
  `GET /store/products?collection_id[]={id}&region_id=…`.
- It's null when none is chosen or the collection has been deleted, so the
  storefront never requests a featured collection that returns 404. The homepage
  uses the remaining collections in their normal order. Hide the section when
  there are no collections with usable handles.
- Edits to the collection itself (its description or images) don't refresh the
  settings cache. Cache the collection request on its own.

### Sharing & search: Ready

Home page title and description, share image, X username, social profile links
(Instagram, Facebook, TikTok, X, YouTube, Pinterest), a switch to hide the store
from search engines, and the Google Search Console verification code.

- **Admin:** Sharing & search section, Marketing role
- **Storefront reads:** `settings.seo.*`. Social links suit a footer; the rest
  already feeds page metadata.

### New badge length: Ready

How many days a product counts as new (30 by default).

- **Admin:** Products section, Marketing or Store Manager
- **Storefront reads:** `settings.products.new_badge_days` with
  `isNew(product, days)`

---

## Browse & discovery

Home, category, collection, search and listing pages.

The home page's structure belongs to the storefront. Staff control only the
hero, About introduction and the featured collection (above). Category sections come straight from
the category tree; there's no admin setting to choose or order them yet.

Collections are optional: the homepage collection section, desktop/mobile
collection menus and collection search suggestions render only available entries.
One collection gets a direct menu link; none hides the collection navigation.
An empty `/collections` index redirects to `/products`; an unknown or deleted
collection handle returns the normal not-found page. Products do not require a
collection assignment.

Hero and About buttons targeting unavailable same-store collections are hidden
without hiding their other content. Collection availability reads all API pages,
so a valid destination beyond the first 100 collections remains usable.

### Category tree: Backend ready

Nested categories such as Women › Accessories › Bags, each with a name,
description, and its own search title and description.

- **Admin:** Products › Categories, plus a Search & sharing box and a Size
  guide box per category
- **Storefront reads:** `GET /store/product-categories` with
  `parent_category`, `category_children`, `+metadata` for
  `metadata.seo_title` / `metadata.seo_description`

### Collections: Backend ready

Edits and seasons such as New Arrivals, each with a description, a banner image
and an optional mobile banner image in metadata.

- **Admin:** Products › Collections, **Website content** box on each collection
- **Storefront reads:** `GET /store/collections` with `fields=+metadata`;
  `metadata.description`, `metadata.hero_image`, `metadata.hero_image_mobile`
- Treat a missing key and an empty string the same (not set): the admin box
  saves cleared fields as `""`. With no mobile image, crop the banner image.

### Product listings: Backend ready

Paginated products with region prices, filterable by category, collection, tag,
type, colour and size, and sortable by newest.

- **Storefront reads:** `GET /store/products` with `region_id`, `limit`,
  `offset`, `order=-created_at`; colour and size filters via
  `variants[options][option_id]` / `variants[options][value]`
- The Store API can't sort by metadata, so a product launched from coming soon
  sorts by its creation date (it still shows the New badge).

### Search with facets: Backend ready

Full-text, typo-tolerant search over published products in the storefront's
sales channel, with counted facets (categories, type, collection, tags).

- **Storefront reads:** `GET /store/search?q=…` with `limit` (1–50, default 24)
  and `offset`. Filters are `category`, `type`, `collection`, `tag` (handles);
  repeat a filter to OR its values.
- Response: `{ products, count, offset, limit, facets }`.
- **Watch out:** results carry no prices. Load prices with
  `/store/products?id=…` and the region once the IDs are known.

### Colour swatches: Backend ready

Colour is a shared option. Each colour value has a hex code or a fabric image
(for prints), so cards and filters can show real swatches.

- **Admin:** Products › Options, Swatch panel on each colour
- **Storefront reads:** option value `metadata.hex` or
  `metadata.swatch_image`; the shared option list from
  `GET /store/product-options?is_exclusive=false`

### Sale prices: Backend ready

Scheduled sales from price lists, optionally limited to a customer group. Show
the original price struck through.

- **Admin:** Price Lists (type Sale)
- **Storefront reads:** `calculated_price.calculated_amount`,
  `original_amount`, `price_list_type: "sale"`

### New badge: Ready

Automatic. Counts from `metadata.launched_at` (stamped when a product launches
from coming soon), otherwise from `created_at`.

- **Storefront reads:** `isNew(product, days)` from `lib/medusa/product.ts`;
  request `+metadata`. Work it out on the server and pass a boolean to the card
  so the browser's clock can't disagree with the render.

### Coming soon: Ready

Products staff mark as coming soon stay visible but can't be bought: the
backend refuses them at add to cart and at checkout. Show "Notify me" instead
of add to cart.

- **Admin:** Notify me box on the product page
- **Storefront reads:** `isComingSoon(product)` from `metadata.coming_soon`

---

## Product page

Fetch with `GET /store/products?handle=…` and `region_id`, requesting
`*variants.calculated_price`, `+variants.inventory_quantity`,
`*variants.images`, `*variants.options`, `+metadata`.

### Colour photography: Backend ready

Staff assign photos and a thumbnail to each colour variant, so the gallery can
switch when a colour is picked. Fall back to the product gallery when a colour
has none. Keep the chosen colour in the URL so links can open on it.

- **Admin:** variant Media
- **Storefront reads:** `*variants.images`, `variants.thumbnail`

### Sizes and stock: Backend ready

Real stock per variant. A size is sold out when inventory is managed, backorders
are off and the quantity is 0. Mark sold-out sizes rather than hiding them.

- **Storefront reads:** `+variants.inventory_quantity`, `manage_inventory`,
  `allow_backorder`

### Fit, care and composition: Backend ready

Copy for detail tabs or accordions, such as "Relaxed fit. The model is 177cm
and wears a size S."

- **Storefront reads:** `metadata.fit`, `metadata.care`, `material`, plus
  `subtitle` and `description`

### Size guide: Ready

A measurement table with how-to-measure notes and an optional diagram.
Resolution order: the product's own guide, then the nearest category's, then
the store default. Shoppers switch between cm and inches, and the chosen size's
row can be highlighted.

- **Admin:** Products › Size guides; Size guide boxes on products and
  categories
- **API:** `GET /store/products/{id}/size-guide` (`size_guide` is null when
  none applies)
- **Storefront reads:** `fetchSizeGuideOnServer(product.id)`,
  `sizeGuideQueries`, `useMeasurementUnit()`, `formatSizeGuideCell()`,
  `sizeGuideColumnHeading()`, `findSizeGuideRow()`; hide the size guide link
  when `size_guide` is null

### Notify me: Ready

For a sold-out size or a coming-soon product. The alert is per variant when a
size is chosen, otherwise per product. Guests enter an email and can tick "send
me offers"; signed-in customers just tap. One email goes out within about 10
minutes of the item becoming buyable.

- **Admin:** Notify me box shows how many people are waiting per size
- **API:** `POST /store/products/{id}/alerts`
- **Storefront reads:** `useCreateProductAlert()`,
  `useWaitingProductAlert()`. A 400 response means the item can be bought now.

### Save to wishlist: Ready

A heart on product cards and the product page, for guests and customers.
Saving with a chosen size remembers it.

- **Storefront reads:** `useWishlistItem()`, `useSaveToWishlist()`,
  `useRemoveFromWishlist()`

### Product search & sharing details: Ready

Staff can override a product's title and description for search results and
link previews.

- **Admin:** Search & sharing box on the product page (`metadata.seo_title`,
  `metadata.seo_description`)
- **Storefront reads:** `buildProductMetadata()`, `productJsonLd()` (price,
  stock, brand)

---

## Cart & checkout

### Cart: Ready

Guest carts are kept in a cookie and moved into the account when the shopper
signs in. Add, change quantity and remove lines, with optimistic updates that
roll back on failure.

- **Storefront reads:** `useCart()`, `useAddToCart()`, `useUpdateLineItem()`,
  `useRemoveLineItem()`, `fetchCartOnServer()`
- Show `item_subtotal`, `shipping_subtotal`, `discount_subtotal`,
  `tax_total`, `total`

### Promo codes & automatic offers: Backend ready

Percentage or fixed codes, free delivery, buy X get Y, campaigns with budgets.
Codes stack on sale prices unless staff restrict them.

- **Admin:** Promotions, Campaigns
- **Storefront reads:** `POST /store/carts/:id` with `promo_codes`
- **Watch out:** a free-delivery code only sticks once a delivery option is on
  the cart.

### Delivery options: Backend ready

Named options with flat prices (for example "Standard delivery · 3–5 days"),
optionally free above a basket value, and optional showroom pickup.

- **Admin:** Settings › Locations & Shipping
- **Storefront reads:** `GET /store/shipping-options?cart_id=…`, then
  `POST /store/carts/:id/shipping-methods`

### Card payment: Paystack and Credo: To build

Both are hosted payment pages: create a payment session, redirect the shopper,
and complete the cart when they return.

- **Providers:** `pp_paystack_paystack`, `pp_credo_credo`
- **Flow:** `POST /store/payment-collections`, create a payment session with a
  provider, redirect to `data.redirect_url`, then
  `POST /store/carts/:id/complete` on `/checkout/callback`
  (`PAYMENT_CALLBACK_URL`)
- Guests must send their email, name and phone with the session.
- **Watch out:**
  - Nothing in the return URL proves payment; completing the cart does.
  - A payment still in flight (a Credo bank transfer) becomes an order marked
    awaiting payment, which the gateway's webhook completes later.
  - Shoppers who pay and never return are handled by the webhook.

### Bag reminder emails: Ready

Emails shoppers who leave items in their shopping bag: by default after 1
hour, 24 hours and 1 week from the bag's last change. Each email lists the
items and has a "View your bag" button and a stop link.

- **Admin:** Settings › Bag reminders. It's off until staff turn it on, and
  shows the timing and the last 30 days of results.
- **Who gets them:** any bag with an email address, from signed-in customers
  or guests who entered it at checkout.
- **Who doesn't:**
  - addresses that used the stop link or unsubscribed from the newsletter;
  - shoppers who placed an order after last changing the bag;
  - bags that are empty.
- **Storefront:**
  - Set the cart's email as early in checkout as possible
    (`POST /store/carts/:id` with `email`). Guests without one can't be
    reminded.
  - `/shopping-bag/restore` is already built.
  - Build the `/shopping-bag/reminders/stop` page with
    `useStopCartReminders()`, and handle `?restore=` on the shopping bag page.

### Newsletter box at checkout: Not available

The admin setting saves, but nothing subscribes the address when an order is
placed. Until the backend does it, call `POST /store/newsletter/subscribe` from
checkout when the box is ticked.

---

## Orders & after purchase

### Order confirmation and order detail: Backend ready

Items, totals, delivery address, payment state and fulfilment status. Viewing by
order ID needs no login, which makes guest confirmation work; a "track my order"
page should also check the email.

- **Storefront reads:** `GET /store/orders/:id`, requesting fulfilment fields
  explicitly

### Emails the backend sends on its own: Ready

No storefront work, but order pages should match their wording.

- Order placed, updated, shipped (with tracking link), delivered, cancelled
- Refund issued
- Return requested, return received
- Exchange created, claim created

### Claim a guest order into an account: Backend ready

- **Storefront reads:** `POST /store/orders/:id/transfer/request`

### Self-service returns: Not available

Medusa's `POST /store/returns` has no ownership check, so it needs a protected
route in front of it first. Customers contact support meanwhile.

---

## Accounts

### Register, sign in, sign out: Ready

Email and password. Signing in merges the guest cart and wishlist into the
account. Logging out clears the auth, cart and wishlist cookies.

- **Storefront reads:** `useRegister()`, `useLogin()`, `useLogout()`,
  `useCustomer()`, `fetchCustomerOnServer()`
- Storefront routes: `/api/auth/login`, `/api/auth/register`,
  `/api/auth/logout`

### Continue with Google: Ready

A link to `/api/auth/google` does the rest, returning to
`/api/auth/google/callback`. Google sign-in can join an existing password
account with the same email. Customers only; staff can't use Google.

### Password reset: To build

The backend already emails a reset link. Build the request form and the page it
lands on.

- **Link target:** `/account/reset-password?token=…&email=…` (or change the
  link in `apps/backend/src/workflows/steps/send-password-reset-email.ts`)
- **Google-only customers** have no password to reset. Offer a "create a
  password" form in the account area that posts `{ password }` to
  `POST /store/customers/me/password` (signed in; refused if they already have
  a password).

### Email verification: To build

After registering, call `POST /auth/verification/request`. The backend emails a
link valid for 15 minutes.

- **Link target:** `/account/verify?token=…`, which posts `{ "code": "<token>" }`
  to `POST /auth/verification/confirm` (or change the link in
  `apps/backend/src/workflows/steps/send-verification-email.ts`)
- Verification is not required today. Requiring it makes login and registration
  answer `verification_required: true` with a limited token, so design that
  state before switching it on.

### Profile, addresses, order history: Backend ready

Name, phone, address book and past orders.

- **Storefront reads:** `/store/customers/me`,
  `/store/customers/me/addresses`, `/store/orders`
- **Watch out:** the Store API can't change a customer's email address (the
  update payload has no `email` field).

### Notification settings: Ready

An "Email me offers" switch (shows "check your inbox to confirm" while pending,
via double opt-in) and the list of Notify me alerts with cancel buttons.

- **API:** `GET/POST /store/customers/me/marketing`,
  `GET /store/customers/me/product-alerts`,
  `DELETE /store/customers/me/product-alerts/{id}`
- **Storefront reads:** `useMarketingPreference()`,
  `useSetMarketingPreference()`, `useProductAlerts()`,
  `useCancelProductAlert()`

---

## Wishlist & alerts

### Wishlist page: Ready

Saved products newest first, with the chosen size. Guest lists live in one
browser for 90 days after the last save, then merge into the account at sign-in;
say so next to a sign-in link. The list holds IDs only, so load products through
`/store/products` with the region for prices.

- **Storefront reads:** `useWishlist()`, `fetchWishlistOnServer()`
- The proxy path `wishlists/current` resolves to the customer's list when signed
  in, or the guest cookie's list otherwise (the first save creates it).

### Back in stock and launch emails: Ready

"Back in stock" and "It's here" emails with a Shop now button linking to
`/products/<handle>`. Staff see waiting counts per size, which helps with
reorders. Alerts give up after 5 failed sends.

### Tell me when a saved item goes on sale: Not available

Would need a backend job; offer it to signed-in customers only when built.

---

## Newsletter & offers

### Signup form: Backend ready

Signup in a standalone section immediately above the footer, with optional double opt-in. The "send me offers" box on Notify
me and the account switch use the same signup.

- **Admin:** Settings › Newsletter (consent wording, success message, double
  opt-in, checkout opt-in label)
- **Storefront reads:** `POST /store/newsletter/subscribe`
- **Watch out:**
  - The response is the same whether or not the address is already on the
    list; never infer membership from it.
  - The consent wording and success message are admin-only settings. Signed-in
    customers can read the consent wording from
    `GET /store/customers/me/marketing`; for guests, hardcode the copy or add a
    small public endpoint.

### Confirm and unsubscribe pages: To build

Landing pages for the links in newsletter emails. Each posts its token and says
what happened.

- `/newsletter/confirm?token=…` → `POST /store/newsletter/confirm`
- `/newsletter/unsubscribe?token=…` → `POST /store/newsletter/unsubscribe`

---

## Search engines & sharing

### Site-wide metadata: Ready

Title template ("Dress | Youjaymharah"), description, favicon, Open Graph and X
cards, indexing rules, Search Console verification, and Organization and
WebSite structured data. Built in `app/layout.tsx` from Settings › Storefront.

### robots.txt, sitemap, home-screen manifest: Ready

`app/robots.ts`, `app/sitemap.ts`, `app/manifest.ts`. The sitemap lists every
product, category and collection and regenerates at most hourly. Its addresses
come from `lib/seo/routes.ts` (`productPath`, `categoryPath`,
`collectionPath`), so update that file when page URLs are decided.

### Per-page metadata and breadcrumbs: To build

Wire the ready helpers into pages as they're built: product metadata and
structured data, category titles from their Search & sharing box, breadcrumb
trails.

- **Helpers:** `buildProductMetadata()`, `productJsonLd()`,
  `breadcrumbJsonLd()`, `<JsonLd>` (`lib/seo/*`, `components/seo/json-ld.tsx`)

### Instant refresh after staff edits: To build

The backend already calls the storefront when storefront settings are saved.
Add the receiving route, which checks a shared secret and revalidates the tag.

- **Route:** `POST /api/revalidate`
- **Header:** `x-revalidate-secret`, compared with `STOREFRONT_REVALIDATE_SECRET`
- **Body:** `{ "tags": ["storefront-settings"] }`
- The backend skips the call when the secret is unset, times out after 5
  seconds, and only logs failures.

---

## Pages the backend links to

Emails and payment gateways send shoppers to these exact addresses. Each must
exist, or the address must change in the backend.

| Address                                   | Arrives from                              | Status   |
| ----------------------------------------- | ----------------------------------------- | -------- |
| `/account/reset-password?token=…&email=…` | Password reset email                      | To build |
| `/account/verify?token=…`                 | Email verification email (15-minute link) | To build |
| `/newsletter/confirm?token=…`             | Newsletter confirmation email             | To build |
| `/newsletter/unsubscribe?token=…`         | Every newsletter email                    | To build |
| `/products/<handle>`                      | Back in stock and launch emails           | To build |
| `/checkout/callback`                      | Paystack and Credo after payment          | To build |
| `/shopping-bag/restore?token=…`           | Bag reminder email, "View your bag"       | Ready    |
| `/shopping-bag/reminders/stop?token=…`    | Bag reminder email, stop link             | To build |
| `/shopping-bag`                           | Where a restored bag opens                | To build |
| `/api/auth/google/callback`               | Google after sign-in                      | Ready    |
| `/api/revalidate`                         | Backend after settings are saved          | To build |

---

## Already built in the storefront

Data and helpers waiting for screens. Recipes are in
`apps/storefront/DATA-LAYER.md`.

| Area                              | Exports                                                                                                                                                                  |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cart                              | `useCart`, `useAddToCart`, `useUpdateLineItem`, `useRemoveLineItem`, `fetchCartOnServer`                                                                                 |
| Customer                          | `useCustomer`, `useLogin`, `useRegister`, `useLogout`, `fetchCustomerOnServer`; Google via `/api/auth/google`                                                            |
| Wishlist                          | `useWishlist`, `useWishlistItem`, `useSaveToWishlist`, `useRemoveFromWishlist`, `fetchWishlistOnServer`                                                                  |
| Alerts & marketing                | `useCreateProductAlert`, `useWaitingProductAlert`, `useProductAlerts`, `useCancelProductAlert`, `useMarketingPreference`, `useSetMarketingPreference`                    |
| Product helpers                   | `isComingSoon`, `isNew`, `onSaleSince` (`lib/medusa/product.ts`); `getStoreRegion`; `getStorefrontSettings`                                                              |
| Catalogue reads                   | `getProductByHandle`, `listProducts`, `getCategoryTree`, `getCategoryByHandle`, `getCollectionByHandle`, `getCollectionById`, `searchProducts` (`lib/medusa/catalog.ts`) |
| Prices                            | `formatPrice`, `getVariantPrice`, `getProductPrice` (`lib/medusa/price.ts`)                                                                                              |
| Variants and stock                | `getColourChoices`, `getSizeChoices`, `findVariant`, `getVariantStock`, `canPurchase`, `getSelectionImages` (`lib/medusa/variants.ts`); `useProductSelection`            |
| Categories, collections, metadata | `getCategoryTrail`, `getCategorySeo`, `getCollectionContent`, `metaText`, `metaImage`                                                                                    |
| Size guide                        | `fetchSizeGuideOnServer`, `sizeGuideQueries`, `useMeasurementUnit`, `formatSizeGuideCell`, `sizeGuideColumnHeading`, `findSizeGuideRow`                                  |
| SEO                               | `buildRootMetadata`, `buildProductMetadata`, `productJsonLd`, `breadcrumbJsonLd`, `<JsonLd>`; `robots.ts`, `sitemap.ts`, `manifest.ts`                                   |

---

## Not available

- **Gift cards, store credit, loyalty points:** not in this Medusa version.
  One-off promo codes are the substitute.
- **Tracking details on the order page:** order status shows; the shipping
  email carries the tracking link.
- **Self-service returns:** needs a protected route first (see Orders).
- **Newsletter opt-in at checkout:** not wired on the backend (see Cart &
  checkout).
- **Sale alerts for wishlist items:** needs a backend job.

## Open decisions

- **Page addresses.** Readable paths like `/women/bags/neat-leather-bag` and
  `/new-arrivals` are agreed in principle; never `/shop`. Type-prefixed
  addresses (`/products/…`) may exist alongside. Not built yet: the sitemap and
  emails still use `/products/…`.
- **Require email verification?** Off today. Switching it on changes the login
  and registration responses, so design the "check your inbox" state first.
- **Newsletter opt-in at checkout.** Call the signup from checkout, or have the
  backend subscribe on order placement.
