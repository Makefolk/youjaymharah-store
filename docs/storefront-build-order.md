# Storefront build order

A build order for the storefront, assuming an empty `apps/storefront` and a
backend that is already running. Each phase ends with something you can open in
a browser and judge, and nothing in a phase depends on a later one.

Framework is your choice; everything below is about what to build and which
backend capability it sits on, not which router to use.

---

## Before you start

Facts about this backend that shape almost every screen:

- **Every `/store` request needs the `x-publishable-api-key` header.** Copy the
  "Web Storefront" key from `Settings › Publishable API Keys` in the admin. A
  missing key fails with a publishable-key error, not an obvious 401.
- **Use the Medusa JS SDK** (`@medusajs/js-sdk`), not bare `fetch`. It adds that
  header and the auth token for you, and it is typed (`HttpTypes.Store*`).
- **Prices come back as-is.** ₦49.99 is `49.99`, never `4999`. Never divide by 100.
- **One region: Nigeria, currency NGN** (USD exists as a secondary currency).
  Pass `region_id` (or `country_code`) when fetching products so prices are
  calculated; without it there are no prices in the response.
- Whether prices include VAT is a store setting, so display the numbers the API
  returns rather than adding tax yourself.
- **Custom endpoints** added by this project (wishlist, newsletter, branding)
  are documented in `docs/api/openapi.json` — see `docs/api/README.md`.
- Local backend: `pnpm run backend:dev` (<http://localhost:9000>, admin at
  `/app`). Demo catalogue: `pnpm run seed:demo` from `apps/backend`, or
  `pnpm run seed:demo reset` to rebuild it.

---

## Phase 0 — Foundations

**Goal:** an empty but correct shell that can talk to the backend.

Build: environment variables (see `apps/storefront/.env.template`), the
region/currency lookup, base layout with header and footer, 404 and error
pages, and your design tokens (type scale, colour, spacing).

**Already in place: how data flows.** How to use it, with recipes, is in
`apps/storefront/DATA-LAYER.md`; deployment details are in
`apps/storefront/DEPLOY.md`.

- **Server Components** call Medusa directly with the server SDK
  (`lib/medusa/server.ts`). Use them for everything public: product lists,
  product pages, categories.
- **Client Components** use `getBrowserSdk()` (`lib/medusa/browser.ts`). It goes
  through this app's `/api/medusa` proxy, which attaches the customer's token
  from an httpOnly cookie, so no token ever reaches browser JavaScript. Pass
  `"current"` as the cart id; the proxy fills in the real one.
- **Sign-in** goes through `/api/auth/login`, `/register`, `/logout` and
  `/google`. Never call `sdk.auth.*` from the browser.
- **React Query** keys live in `lib/query/keys.ts`. Include the region and
  locale in any key whose response has prices or translated text.
  `features/cart` and `features/customer` are worked examples, including an
  optimistic quantity change with rollback and prefetching on the server.

Backend: `GET /store/regions`.

**Done when:** a page renders the store name and the Nigeria region's currency,
fetched live.

**Watch out:** decide now whether URLs carry a country prefix (`/ng/...`). It is
far more painful to add later, and with one region you may not want it at all.

---

## Phase 1 — Browse and discovery

**Goal:** shoppers can find products.

Build: home page, category pages (the catalogue nests, e.g. Women › Accessories
› Bags), collection pages, a listing grid with pagination, sorting, and search.
Product cards show image, title, price, sale price, and colour squares.

Backend:

- `GET /store/product-categories` (nested via `parent_category`,
  `category_children`)
- `GET /store/collections`
- `GET /store/products` with `region_id`, `limit`, `offset`, `q` for search
- Filter by colour or size with
  `variants[options][option_id]` / `variants[options][value]`
- `GET /store/product-options?is_exclusive=false` lists the shared **Colour**
  and **Size** options to build filter controls from
- **Home page content** comes from `getStorefrontSettings().homepage`:
  - `hero`: render it only when `enabled` is true. `title` and
    `desktop_image_url` are then guaranteed; use the desktop image when
    `mobile_image_url` is null. A non-null `desktop_video_url` makes it a
    video: autoplay it muted, looped and inline, with the image as `poster`,
    and show only the image under `prefers-reduced-motion`. Details in
    `docs/storefront-capabilities.md`.
  - `featured_collection_id`: fetch it with
    `GET /store/collections/{id}?fields=+metadata` for `metadata.description`,
    `metadata.hero_image` and `metadata.hero_image_mobile`. When it's null,
    hide the section.
  - `about`: the introduction below the collections. Render only when enabled;
    use the optional image with its alt text, or the brand panel without an image.
    Heading, paragraphs and the optional link are editable in Settings › Storefront
    › Homepage About. The full About page has separate content.
  - The layout itself stays in code. Category sections use the category tree.

**Done when:** you can walk from the home page into a category, filter by
colour, sort, and page through results.

**Watch out:**

- Colour and Size are _shared_ options, so a product's `options[].values` may
  list every value that exists, not just the ones that product comes in. Derive
  the real list from the product's `variants[].options`.
- A colour's swatch is on the option value's metadata: `hex` (e.g. `#1c1c1c`),
  or `swatch_image` for prints. Render a square, not a word.
- Sale prices arrive as `calculated_price.calculated_amount` with
  `original_amount` and `price_list_type: "sale"` — show the original struck
  through.
- **"New" badge:** a date rule, not a flag staff maintain. Use
  `isNew(product, newBadgeDays)` from `lib/medusa/product.ts` (request
  `+metadata`), with the number of days from `getStorefrontSettings()` (staff
  set it under Settings › Storefront; 30 by default). It counts from
  `metadata.launched_at`, which is stamped when a product is launched from
  coming soon, otherwise from `created_at`. Work it out on the server and pass a
  boolean to the card, so the browser's clock can't disagree with the render.
- **"New in" page:** `GET /store/products` with `order=-created_at`. The Store
  API can't sort by metadata, so a product launched from coming soon sorts by
  when it was created; it still shows the badge.

---

## Phase 2 — Product page

**Goal:** enough information and confidence to add to cart.

Build: image gallery, colour swatches, size selector, price, stock messaging,
add to cart, and the details copy. Selecting a colour should switch the gallery
to that colour's photos; keep the choice in the URL so a link can open on a
specific colour.

Backend: `GET /store/products?handle=...` with `region_id`, requesting
`*variants.calculated_price`, `+variants.inventory_quantity`, `*variants.images`,
`*variants.options`, `+metadata`.

**Done when:** picking a colour and size selects a real variant, the price and
photos follow the choice, and sold-out combinations are visibly unavailable.

**Watch out:**

- Variants carry their own `images` and `thumbnail` where a colour has its own
  photography; fall back to the product's images when they are empty.
- Mark sold-out colours and sizes rather than hiding them: a variant is
  unbuyable when `manage_inventory` is true, `allow_backorder` false and
  `inventory_quantity` is 0.
- Product `metadata` holds `fit` and `care` copy; `material` holds the
  composition.
- **Notify me** (already built): show it instead of "Add to bag" for a sold-out
  size, and for the whole product when `metadata.coming_soon` is `true`
  (`isComingSoon` in `lib/medusa/product.ts`). Guests enter an email plus an
  optional "send me offers" box; signed-in customers only tap. Hooks and rules
  are in `DATA-LAYER.md` recipe 5. The backend refuses to sell a coming-soon
  product, so a stale page cannot check one out.
- **Size guide** (already built): fetch it in the page with
  `fetchSizeGuideOnServer(product.id)`. Show a "Size guide" link that opens the
  table in a drawer, hidden when `size_guide` is null, with a cm/in toggle
  (`useMeasurementUnit`) and the selected size's row highlighted. Helpers and
  rules are in `DATA-LAYER.md` recipe 5.

---

## Phase 3 — Cart

**Goal:** a reliable basket.

Build: add/update/remove lines, quantity control, a cart page and a drawer,
totals, promo code entry, and an empty state. Keep the cart id in a cookie and
recover gracefully when it has been completed or deleted.

Backend: `POST /store/carts`, `/store/carts/:id/line-items`,
`POST /store/carts/:id` (email, addresses, `promo_codes`).

**Done when:** a guest can build a cart, apply a promo code, and see totals that
add up.

**Watch out:**

- Show totals the way the API breaks them down: `item_subtotal`,
  `shipping_subtotal`, `discount_subtotal`, `tax_total`, `total`. Those are the
  ones that reconcile.
- Promo codes stack on sale prices by design. If that is not wanted, it is a
  merchandising decision made in the admin, not something to patch here.
- A free-delivery code only sticks once a delivery option is on the cart. Apply
  it (or re-apply it) after the delivery step, or it silently does nothing.

---

## Phase 4 — Checkout and payment

The riskiest phase; treat it as its own milestone.

**Goal:** a guest can pay with a card and get an order.

Build: email and address step, delivery option step, payment method choice,
review, then the redirect to the gateway and the return leg.

Backend, in order:

1. `POST /store/carts/:id` with email and addresses
2. `GET /store/shipping-options?cart_id=...` → `POST /store/carts/:id/shipping-methods`
3. `POST /store/payment-collections` then
   `POST /store/payment-collections/:id/payment-sessions` with the provider id
   (`pp_paystack_paystack` or `pp_credo_credo`)
4. Redirect the browser to `payment_session.data.redirect_url`
5. The gateway returns the customer to `PAYMENT_CALLBACK_URL`; on that route,
   call `POST /store/carts/:id/complete` and show the order

**Done when:** a real test-card payment produces an order, and abandoning the
payment page returns the shopper to checkout with the cart intact.

**Watch out:**

- **Guests need contact details passed explicitly.** Medusa only gives payment
  providers the customer's details when logged in, and both gateways need an
  email to open a transaction. Send `data.payer` (`email`, `first_name`,
  `last_name`, `phone`) when creating the payment session.
- Re-create the payment session immediately before redirecting, so the gateway
  charges the current total after any late change (promo code, delivery
  option).
- Nothing in the return URL proves payment. Completing the cart is what makes
  the backend verify with the gateway; a failed or cancelled payment throws and
  no order is created.
- A payment still in flight (a Credo bank transfer) becomes an order marked
  _awaiting payment_, which the gateway's webhook completes later. Do not
  present that as fully paid.
- Customers who pay and never return are handled by the webhook, so the same
  cart may already be an order when your callback runs; treat that as success.
- The system "Manual Payment" provider takes orders without collecting money.
  Useful locally, removed before launch.

---

## Phase 5 — Order confirmation and tracking

**Goal:** the shopper knows what happens next without emailing you.

Build: the confirmation page after checkout, and a page to view an order later.
Show items, totals, delivery address, payment state, fulfilment status, and
tracking numbers and links once shipped.

Backend: `GET /store/orders/:id`. Fulfilments are not in the default field set,
so request them explicitly (`fields=+fulfillments.labels.*`) — worth confirming
the exact string against the running API when you build it.

**Done when:** an order placed in Phase 4 is viewable, and a shipped order shows
its tracking link.

**Watch out:** `GET /store/orders/:id` needs no login, which is what makes the
guest confirmation page work. If you build a "track my order" page, check the
email matches the order rather than treating the id alone as proof.

---

## Phase 6 — Accounts

**Goal:** returning customers.

Build, in this order:

1. Register, log in, log out
2. **Email verification.** After registering, call
   `POST /auth/verification/request` with the token registration returned and
   `{ "entity_id": "<email>", "entity_type": "email" }`. The backend emails a
   link to `/account/verify?token=...`, valid for 15 minutes. Build that page to
   post `{ "code": "<token>" }` to `POST /auth/verification/confirm`, or change
   the link in `apps/backend/src/workflows/steps/send-verification-email.ts`.
3. **Password reset: both the request form and the reset page.** The backend
   already sends customers to `/account/reset-password?token=...&email=...`, so
   build that exact route or change the link in
   `apps/backend/src/workflows/steps/send-password-reset-email.ts`. Without it,
   anyone who forgets a password is locked out.
4. Profile (name, phone), address book
5. Order history and order detail, reusing Phase 5's components
6. Claiming a guest order into an account (`/store/orders/:id/transfer/request`)
7. Google sign-in, once credentials are set (see below)
8. **Notifications settings:** an "Email me offers" switch
   (`useMarketingPreference`, `useSetMarketingPreference`) and the list of
   "Notify me" alerts with a cancel button (`useProductAlerts`,
   `useCancelProductAlert`). Turning offers on sends a confirmation email
   first, so show the `pending` status as "Check your inbox to confirm".

Backend: `/auth/customer/emailpass` (login, register), `/store/customers`,
`/store/customers/me`, `/store/customers/me/addresses`, `/store/orders`.

**Google sign-in** is wired up end to end and switches on once
`GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `GOOGLE_CALLBACK_URL` are set on
the backend. Set `GOOGLE_CALLBACK_URL` to
`https://<storefront>/api/auth/google/callback`. The storefront then only needs
a "Continue with Google" link to `/api/auth/google`: the callback route links
the sign-in to an existing account with the same email, or creates one, and
signs the customer in.

Linking only happens for providers that verify the email, which is why a
Google sign-in can join an existing password account but a password signup can
never claim a Google one.

**Setting a password later.** A customer who signed up with Google has no
password, so the reset flow has nothing to reset. Offer a "create a password"
form in the account area that posts to `POST /store/customers/me/password`
with `{ password }`. They must be signed in; the email comes from their
account. If they already have a password the call is refused — that case is a
reset, not a set.

**Requiring verification.** Nothing forces it today, so an unverified customer
can still sign in. To require it, add this to `projectConfig.http` in
`medusa-config.ts`:

```ts
authVerificationsPerActor: {
  customer: [{ auth_provider: "emailpass", entity_type: "email" }],
},
```

Login and registration then answer `verification_required: true` with a
limited token until the link is confirmed, so handle that response before
switching it on. Google sign-ins are unaffected, because only `emailpass` is
listed.

**Done when:** a customer can register, verify, log out, reset a forgotten
password, and see a past order.

**Watch out:** the store API cannot change a customer's email address — the
update payload has no `email` field. Either leave it read-only or plan the
auth-identity flow deliberately.

---

## Phase 7 — Wishlist

**Goal:** saving pieces for later, which fashion shoppers expect.

Build: a heart on product cards and the product page, and an account wishlist
page showing the saved colour and size with a link back to that variant.

Backend and data layer (already built): guests and customers both have
wishlists. Use the hooks in `apps/storefront/features/wishlist/hooks.ts`
(`useWishlist`, `useWishlistItem`, `useSaveToWishlist`,
`useRemoveFromWishlist`); `DATA-LAYER.md` recipe 5 has a heart button.

**Done when:** saving from a card and from the product page both work for a
guest and a customer, a guest's saves appear in their account after signing
in, and the list survives logging out and back in.

**Watch out:**

- It returns IDs only. Load the products through `/store/products` so region
  pricing applies and unpublished products drop out.
- One entry per product: saving again with a `variant_id` updates that entry to
  the chosen colour and size.
- A guest's list lives in one browser until they sign in. It is kept for 90
  days after their last save. Say so on the wishlist page, next to a sign-in
  link.
- Any later "tell me when it's on sale" feature needs an email address, so
  offer it to signed-in customers only.

---

## Phase 8 — Newsletter

**Goal:** collect email addresses, which the store currently cannot do at all.

Build: a standalone signup section above the footer, an opt-in at checkout, and landing pages for the confirm
and unsubscribe links in the emails.

Backend (custom, already built): `POST /store/newsletter/subscribe`,
`/confirm`, `/unsubscribe` (the latter two take the token from the email).

**Done when:** a signup produces a confirmation email, and the confirm link
lands on a page that says what happened.

**Also already built:** the "send me offers" box on "Notify me" and the account
switch from Phase 6 go through this same signup and double opt-in.

**Watch out:**

- The consent wording, success message and checkout opt-in label live in
  admin-only settings. Signed-in customers can read the consent wording from
  `GET /store/customers/me/marketing`; for guests, hardcode the copy or add a
  small public endpoint that exposes those few fields.
- The checkout opt-in is not wired up on the backend yet: the admin setting
  saves, but nothing subscribes the address when an order is placed. Until it
  is, call `POST /store/newsletter/subscribe` from the checkout page when the
  box is ticked.
- Subscribe always answers the same way whether or not the address is already
  on the list, so never infer membership from the response.

---

## Phase 9 — Ready for real traffic

Build: image optimisation (allow the R2/S3 domain), loading and error states
everywhere, analytics, and an accessibility pass — keyboard operation of the
colour and size selectors, real labels on the swatches, and visible focus.

Already built (search & sharing, all driven by Settings › Storefront in the
admin; see `DATA-LAYER.md` recipe 10):

- Site-wide metadata in `app/layout.tsx`: title template, description,
  favicon, Open Graph and X cards, indexing, Google Search Console
  verification, and Organization and WebSite structured data.
- `app/robots.ts` and `app/sitemap.ts`. The sitemap lists products,
  categories and collections at `/products/<handle>`, `/categories/<handle>`
  and `/collections/<handle>`; change `lib/seo/routes.ts` if the pages live
  elsewhere.
- Still to wire into each page as it is built: `buildProductMetadata` and
  `productJsonLd` on the product page, `breadcrumbJsonLd` on product and
  category pages, and `generateMetadata` with the category or collection name
  (categories have their own `seo_title` and `seo_description` in metadata).
- **Instant updates** (backend side built): add `app/api/revalidate/route.ts`.
  The backend sends `POST /api/revalidate` with header `x-revalidate-secret`
  and body `{ "tags": ["storefront-settings"] }` whenever Brand or Sharing &
  search is saved. Compare the header with `STOREFRONT_REVALIDATE_SECRET` (set
  the same value on both services; answer 401 if it differs), then call
  `revalidateTag` for each tag. Read Next's `revalidateTag` docs in
  `node_modules/next/dist/docs` first; its signature changed in Next 16.
  Without this route, changes still appear within 5 minutes.
- **Home-screen manifest** (built): `app/manifest.ts` serves
  `/manifest.webmanifest` with the brand name, description and favicon from
  Settings › Storefront, and Next links it from every page.

**Done when:** a Lighthouse pass is clean enough to launch behind and the site
is usable on a mid-range Android phone on a slow connection.

---

## Later, once the shop is live

- **Self-service returns.** Medusa has `POST /store/returns`, but it has no
  authentication and does not check that the order belongs to the requester.
  Put an authenticated route in front of it before exposing it, and configure a
  return shipping option in the admin.
- **Back-in-stock alerts** — needs a small backend module; valuable given how
  often sizes sell out.
- **Reorder** from a past order.
- **Notify me when a saved item goes on sale.**
- Saved cards, two-factor login, Google sign-in: all possible, none required to
  trade.
- Gift cards and store credit are not available in this Medusa version.

---

## Launch checklist

- [ ] Card payment works end to end with live keys
- [ ] Password reset works (request → email → reset → log in)
- [ ] Order confirmation email arrives and its totals match the site
- [ ] Sold-out sizes cannot be added to a cart
- [ ] Delivery prices and any free-delivery threshold are right
- [ ] Manual Payment removed from the Nigeria region
- [ ] Newsletter signup stores a subscriber and confirms by email
- [ ] Tested on a phone, not just a desktop browser
