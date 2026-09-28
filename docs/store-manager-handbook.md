# Running the Youjaymharah store

Operations handbook for the store manager: taking the store from an empty
production database to its first shipped order, then keeping it running.

- Admin: `https://<admin-domain>/app`
- Region: Nigeria, NGN
- Warehouse: Lagos Warehouse
- Payments: Paystack, Credo (hosted checkout)
- Platform: Medusa 2.19

Menu paths are written as `Settings › Tax Regions`. Steps marked
**(Super Admin)** need the owner's account.

---

## 1. Developer pre-flight

The store manager can't do these; whoever deploys must.

1. **Production environment.** Point `DATABASE_URL` at a fresh production
   database, not `youjaymharah-dev`. Set strong `JWT_SECRET` /
   `COOKIE_SECRET` (independent random values, at least 32 characters), configure
   production Redis, set the CORS variables to the real domains, and set
   `STORE_NAME`, `SUPPORT_EMAIL`, `STOREFRONT_URL` and `ADMIN_URL`. Production
   refuses to start without Redis, these two secrets and a 64-character
   `EMAIL_DELIVERY_ENCRYPTION_KEY`.
2. **First admin.** Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` before the first
   deploy; its seed step creates this user as Super Admin. Hand the credentials
   to the store owner and have them change the password.
3. **Deploy.** Follow [Production deployment](deployment.md). The deploy runs
   the database migrations, then the seed scripts as a separate step that
   stops the deploy if a seed fails. The initial seed runs once and creates the
   records in section 2. Do **not** run `seed:demo` against production.
4. **Storefront key.** Copy the "Web Storefront" key from
   `Settings › Publishable API Keys` into the storefront's
   `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`.
5. **Payments live mode.** Set `CREDO_MODE=live` with live Credo keys,
   `CREDO_WEBHOOK_TOKEN` and `CREDO_BUSINESS_CODE`, and the live
   `PAYSTACK_SECRET_KEY`. Set `PAYMENT_CALLBACK_URL` to
   `https://<storefront>/checkout/callback`. Register webhooks at
   `https://<backend>/hooks/payment/paystack_paystack` and
   `https://<backend>/hooks/payment/credo_credo`. They complete orders for
   customers who pay but never return to the site.
6. **Image storage.** Fill the `S3_*` variables for Cloudflare R2 (see
   `apps/backend/.env.template`), or product image uploads will fail.
7. **Email.** Set `RESEND_API_KEY` and a `RESEND_FROM_EMAIL` on a domain
   verified in Resend, plus `EMAIL_DELIVERY_ENCRYPTION_KEY` from step 1:
   without that key every email fails before it is sent. Every email depends
   on these: order confirmation,
   shipping, delivery, changes and cancellation; returns, exchanges, claims and
   refunds; email verification and password resets; and team invites.
   Configure the [Resend webhook](resend-webhooks.md) and its separate signing
   secret so provider unsubscribes and delivery problems reach the store.

See [Security and reliability](security-and-reliability.md) for deployment
checks, test coverage, remaining dependency advisories, and operational limits.

## 2. What already exists on day one

For trending searches, open **Settings > Trending searches** and approve up to
100 catalog phrases, one per line. Use no customer names, contact details or
private messages. Saving an empty list disables trending; normal product search
still works. Phrases only appear after five searches in seven days and a current
published product match. Marketing, Store Managers and the owner can edit;
Support is read-only. Unapproved phrases still work in normal product search;
they are not counted for trending or collected into a pending-approval queue.
The initial seed provides 20 common clothing/fabric phrases unless a vocabulary
is already saved or explicitly configured. Review the list for your catalog;
re-running the focused seed will not overwrite your changes or an empty list.

On the same page, **Suggested searches** holds up to 10 phrases to show while
nothing is trending yet, such as on a new store. The search box labels them
**Suggestions** rather than **Trending searches**, hides any that don't
currently match a published product, and stops showing them as soon as real
trending phrases exist. They don't need to be on the approved list above.
See [Search privacy](search-privacy.md).

| Record                  | Created as                                                         | You still need to                                                                               |
| ----------------------- | ------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Store                   | "Youjaymharah", NGN default, USD secondary                         | Check the name; remove USD if you won't sell in dollars                                         |
| Region                  | Nigeria, NGN, payment providers: Manual, Credo, Paystack           | Decide on tax-inclusive pricing; remove Manual Payment                                          |
| Tax region              | Nigeria, no rate set (0%)                                          | Set 7.5% VAT                                                                                    |
| Location                | Lagos Warehouse, city only, manual fulfilment                      | Add the full address; set up delivery options                                                   |
| Sales channel           | Default Sales Channel, linked to the warehouse and storefront key  | Nothing, but every product must be in it                                                        |
| Team roles              | Store Manager, Support / Fulfillment, Marketing (plus Super Admin) | Invite people with the right role                                                               |
| Storefront & newsletter | Brand filled from environment settings on first open               | Upload the logo, browser icon and share image; switch on newsletter sign-up and review its text |

## 3. First-day setup

Work through these in order; each relies on the ones before it.

1. **Sign in and secure the owner account.** Open `/app` on the backend
   domain, sign in, change the password and add your name under
   `Settings › Profile`.
2. **Check store details and branding (Super Admin).** `Settings › Store`:
   confirm name and currencies (NGN stays the default). `Settings › Storefront`,
   **Brand**: store name, logo, browser icon (favicon) and support email. The
   name, logo and support email also appear in customer emails.
3. **Invite the team (Super Admin).** `Settings › Users › Invite`: enter the
   email, pick a role (see section 5) and send.
4. **Set VAT and choose how prices are shown.**
   - `Settings › Tax Regions › Nigeria`, default rate `⋯ › Edit`: name "VAT",
     rate **7.5**.
   - `Settings › Regions › Nigeria › ⋯ › Edit`: turn on **Tax inclusive
     pricing** if the prices you enter already include VAT (a ₦45,000 tag
     means ₦45,000 at checkout). Off means VAT is added at checkout.
   - Decide this **before** entering prices, and confirm with your accountant.
5. **Review payment methods.** `Settings › Regions › Nigeria › ⋯ › Edit`,
   field **Payment Providers**. Remove **Manual Payment** before launch: it lets
   customers place orders without paying. Paystack and Credo charge the
   customer on the gateway's page, so orders arrive already _captured_; you
   never press "Capture payment".
6. **Complete the warehouse and create delivery options.**
   1. `Settings › Locations & Shipping › Shipping Profiles`: make sure a
      default profile exists.
   2. Open **Lagos Warehouse** and add the full street address.
   3. **Shipping** section: `⋯ › Enable`, then **Create service zone**
      "Nigeria", and under **Manage areas** tick Nigeria.
   4. **Create option** per delivery speed: **Fixed** price, customer-facing
      name ("Standard delivery · 3–5 days"), the default shipping profile,
      **Manual** provider, **Enable in store** on, price in NGN.
   5. Optional: free delivery over a basket value via a conditional price
      (minimum cart total, e.g. ₦100,000 → ₦0).
   6. Optional: enable **Pickup** for showroom collection.
   - Different prices for Lagos and elsewhere: create two clearly named options
     ("Lagos delivery", "Outside Lagos"). Ask the developer for automatic
     pricing by state.
7. **Add return and refund reasons.** `Settings › Return Reasons` and
   `Settings › Refund Reasons`. Start with: Wrong size, Not as pictured,
   Damaged in delivery, Changed mind, Wrong item sent.
8. **Build the catalogue.**
   1. **Categories** first (`Products › Categories`), nested: Women › Dresses,
      Women › Accessories › Bags. Keep them Active and Public.
   2. **Collections** for edits and seasons.
   3. **Colours and sizes** are shared options (`Products › Options`):
      each colour is defined once and reused by every product. Open a colour
      value and use the **Swatch** panel to set its colour (or upload a
      fabric image for prints and stripes); that square is what shoppers
      click on the site. Add new colours and sizes here before using them.
   4. **Products**: title, description, images, then add the existing
      _Colour_ and _Size_ options and tick the values this product comes in;
      under **Organize** set category, collection, the default shipping
      profile and the **Default Sales Channel**; enter SKUs and NGN prices and
      keep **Managed inventory** on.
   5. **Colour photos** (optional): on a variant, **Media** lets you pick
      which product photos belong to that colour and its thumbnail. The site
      then shows only those photos once a shopper picks the colour.
   6. **Stock**: `Inventory`, pick the item, **Locations › ⋯ › Edit**, set the
      in-stock quantity at Lagos Warehouse. New products start with none.
   - A product missing from the site is usually a draft, missing from the
     Default Sales Channel, or has no stock at Lagos Warehouse.
   - Many products: `Products › Import` with a CSV (export one finished
     product first to copy its columns).
9. **Set up newsletter sign-up.** `Settings › Newsletter`. Sign-up is **off**
   until you switch it on, and until then the sign-up form doesn't appear in
   the site's footer. Then review:
   - **Heading** and **Description**: the text above the sign-up field in the
     footer. Leave either empty to use the default shown in grey.
   - **Consent text**: shown under the field, and saved with each subscriber
     as the wording they agreed to.
   - **Audience**: the Resend audience confirmed subscribers are added to.
     Without one, subscribers are kept in the store but not added to Resend.
   - **Reply-to** and the checkout label. The **Success message** is not shown
     on the site: after signing up, shoppers see a "Check your inbox" message
     explaining the confirmation email.

   The confirmation email opens a page on the site where the shopper presses a
   button to confirm; opening the link alone does nothing, so email scanners
   can't sign anyone up. Unsubscribe links work the same way. Confirmation
   links expire after 24 hours; the shopper can sign up again for
   a new link. Signing up repeatedly within a minute does not send more emails.
   The **Contact sync** row shows contacts waiting for Resend. Retries run every
   five minutes; a persistent backlog needs a developer to check the selected
   audience and API credentials. Before sending campaigns, have the developer
   verify that Resend-originated unsubscribes are reflected in store consent.
   **Delivery blocks** counts addresses blocked after a hard bounce, spam
   complaint or provider suppression. This is separate from consent: do not
   sign someone up again to bypass a block; ask a developer to review it.
   **Webhook processing** counts received provider updates still being
   processed. Recovery runs every minute; report a persistent backlog.

10. **Run one real test order end to end.** Buy a cheap item on the live site
    through Paystack; confirm the order, the captured payment and the
    confirmation email; fulfil, ship with tracking (check the shipping email),
    mark delivered; refund it in full and confirm the money returns.

## 4. Day-to-day playbooks

Every order task starts from `Orders` → open the order.

### Shipping an order and adding tracking

- **Only ship orders whose payment is Captured.** _Awaiting_ means the money
  hasn't landed yet, usually a Credo bank transfer in progress. The gateway
  updates it automatically when the transfer arrives.

1. **Unfulfilled items › ⋯ › Fulfill items**, check location and quantities,
   **Create fulfillment**.
2. When the courier collects: **Mark as shipped › Add tracking number** with
   the tracking number and URL.
3. When delivered: **Mark as delivered** (can't be undone).

With "Send notifications" on, **Mark as shipped** emails the customer the
tracking number and link, and **Mark as delivered** emails a delivery
confirmation. The customer's account page shows "Shipped" but not the link, so
point them to the email.
Guide: <https://docs.medusajs.com/user-guide/orders/fulfillments>

### Refunds

Check the order's **Payments** section for the provider.

- **Paystack:** payment `⋯ › Refund`, amount, reason, note, **Save**. Paystack
  returns the money to the card; settlement can take several working days.
- **Credo:** the Refund button shows "Credo refunds must be issued from the
  Credo dashboard". Refund there and record the Credo reference in your
  refunds log; the admin will still show the order as unrefunded.
- **Manual Payment / transfer:** send the money back, then record it with the
  refund form.

Recording a refund here (Paystack or manual) emails the customer the amount and
reason, never your note. A refund made in the Credo dashboard sends nothing, so
tell the customer yourself.

Refunds are final. Guide: <https://docs.medusajs.com/user-guide/orders/payments>

### Returns, size exchanges and damaged-item claims

Customers can't request these on the website yet; they contact you.

- **Return:** Summary `⋯ › Create Return`, add items, reason, location,
  **Confirm Return**. On arrival, **Receive items** (mark damaged pieces), then
  refund the outstanding amount. The customer is emailed at each stage: what to
  send back and where (the return location's address, so keep it complete),
  that it arrived, and the refund.
- **Exchange:** return one item and send another (size swap); the difference
  is charged or refunded. Confirming it emails the customer what is coming,
  what to send back and where, and any balance.
- **Claim:** wrong or damaged item sent; replace or refund without waiting for
  the return. Confirming it emails the customer the replacement or refund, and
  whether to send anything back.

Guides: [Returns](https://docs.medusajs.com/user-guide/orders/returns) ·
[Exchanges](https://docs.medusajs.com/user-guide/orders/exchanges) ·
[Claims](https://docs.medusajs.com/user-guide/orders/claims)

### Editing or cancelling an order

Before shipping you can edit an order (swap a size, add or remove items). With
"Send notification" on, confirming the edit emails the customer the updated
order and any balance left to pay or refund. To
cancel, choose **Cancel** from the order's menu: reserved stock is released
and the customer is emailed that the order was cancelled and will be refunded.
Then refund the payment (manually for Credo).
Guides: [Edit](https://docs.medusajs.com/user-guide/orders/edit) ·
[Manage](https://docs.medusajs.com/user-guide/orders/manage)

### WhatsApp, Instagram and phone orders

Use **draft orders** so these sales share the website's stock.

1. `Orders › Drafts › Create`: region Nigeria, sales channel, customer email
   and address, **Save**.
2. Add items and a delivery option.
3. Once paid (e.g. transfer): **Convert to order**, then **Mark as paid** in
   the order summary.

Guides: [Draft orders](https://docs.medusajs.com/user-guide/orders/draft-orders) ·
[Create](https://docs.medusajs.com/user-guide/orders/draft-orders/create) ·
[Manage & convert](https://docs.medusajs.com/user-guide/orders/draft-orders/manage)

### In-store sales (POS)

Medusa has no built-in till app.

- **Now:** create a shop location (`Settings › Locations & Shipping › Create`)
  and ideally an "In-store" sales channel linked to it, so shop stock is
  separate and the website can't oversell. Record each sale as a draft order,
  take payment on your card terminal or by transfer, convert and **Mark as
  paid**.
- **Later:** a dedicated POS app on the same backend (barcode scanning,
  terminal integration, receipts) — a development project. See the
  [POS recipe](https://docs.medusajs.com/resources/recipes/pos) and
  [omnichannel recipe](https://docs.medusajs.com/resources/recipes/omnichannel).

### Promotions, codes and sales

- **Promo codes** (`Promotions › Create`): percentage or fixed off the order,
  specific products or delivery; restrict to categories, collections or
  customer groups.
- **Automatic promotions**, **Buy X get Y**, and **Campaigns** (dates and a
  budget by uses or amount).
- **Sales** (`Price Lists › Create`, type _Sale_): scheduled reduced prices,
  shown struck through on the site; can target a customer group.
- Codes also apply to items already on sale (they stack). To exclude sale
  items, restrict the promotion or turn off **Discountable** on those
  products.
- Free-delivery codes only stick once a delivery option is chosen.

Guides: [Promotions](https://docs.medusajs.com/user-guide/promotions/create) ·
[Campaigns](https://docs.medusajs.com/user-guide/promotions/campaigns) ·
[Price lists](https://docs.medusajs.com/user-guide/price-lists/create)

### Stock and reservations

Stock is per location. Placed orders **reserve** items until fulfilled, so the
available count can be lower than the shelf. Adjust under
`Inventory › item › Locations › ⋯ › Edit`.
Guides: [Inventory](https://docs.medusajs.com/user-guide/inventory/inventory) ·
[Reservations](https://docs.medusajs.com/user-guide/inventory/reservations)

### Home page

`Settings › Storefront › Homepage` (Marketing or Store Manager) fills in the home
page. The layout and the order of sections are set by the website itself.

- **Hero banner:** the large image at the top, with an optional eyebrow line
  (like NEW SEASON), a headline, a short description and a button.
  - To show it, add a headline and a desktop image (landscape, at least
    2400 x 1200px), then turn on **Show the hero banner**.
  - A mobile image (portrait, at least 1080 x 1350px) is optional. Without
    one, phones show a crop of the desktop image.
  - **Photo or video:** choose **Video** to play a short silent loop instead
    of the photo.
    - Use MP4 (H.264), under 25 MB and around 10–20 seconds.
    - Keep the photos. They show while the video loads, on phones that block
      autoplay, and for visitors who turn off motion.
    - A mobile video (portrait) is optional. Without one, phones show a crop
      of the desktop video.
    - The video plays without sound.
  - The button needs both a label and a destination. The destination is
    either a page on the store starting with "/", like `/new-arrivals`, or a
    full `https://` address.
  - Turning the banner off keeps everything you typed, so you can prepare the
    next one in advance.
  - **Previous banners:** each save that changes the banner keeps the one it
    replaced, with who changed it and when. The last 10 are listed under the
    Homepage section.
    - **Restore** brings one back exactly as it was, shown or hidden.
    - The banner it replaces is kept too, so a restore can be undone the same
      way.
- **Featured collection:** pick one collection to feature. The website uses
  the collection's own description and images. Set these on the collection
  itself, in its **Website content** box under `Products › Collections`.
  Deleting the featured collection hides the section until you pick another.
- Changes reach the website within a few minutes.

### Bag reminders

`Settings › Bag reminders` (Marketing or Store Manager) emails shoppers who
leave items in their shopping bag.

- **Off until you turn it on.** Once on, reminders start within 10 minutes for
  recently changed bags. Older bags are never emailed.
- **When:** 1 hour, 24 hours and 1 week after the shopper last changed their
  bag. Change the hours, or clear the second or last reminder to send fewer.
  A shopper who comes back and changes their bag moves the next reminder
  later.
- **Who:** signed-in customers, and guests who entered their email at
  checkout.
- **Who isn't reminded:**
  - anyone who clicked "Stop bag reminders" in an email;
  - anyone who unsubscribed from the newsletter;
  - anyone who ordered after last changing their bag.
- **"View your bag"** in the email reopens their bag on the website, even on
  another device.
- **Last 30 days** shows:
  - bags reminded;
  - bags reopened from an email;
  - orders placed from reminded bags, and what they were worth;
  - how many people stopped reminders.

### Search & sharing

The search box's **Trending searches** come from shoppers' own searches,
limited to phrases approved in `Settings › Trending searches` (see section 2).
Ask Marketing or the owner to approve ordinary catalogue phrases such as
"dresses" and "linen". A phrase appears only after five searches in seven days
and while it still finds visible products. Until one qualifies, the box shows
the **Suggested searches** from the same page, labelled **Suggestions**. An
empty list does not mean product search is broken.
See [Search privacy](search-privacy.md).

`Settings › Storefront` controls how the store looks in Google and when a link
is shared on WhatsApp, Instagram or X. Marketing edits **Sharing & search**; the
store owner edits **Brand**.

- **Home page title** (about 60 characters) and **description** (about 155):
  what search results show for the store. Other pages show "Page name | Store
  name".
- **Share image:** 1200 x 630px, shown when someone shares a link to the store.
  Product links use the product's photo instead.
- **Products and categories:** each product and each category has a **Search &
  sharing** box for its own title and description. Leave it empty to use the
  product or category name and description.
- **Social profiles** and **X username:** tell search engines which accounts
  belong to the store.
- **Google Search Console:** to prove to Google the site is yours, choose the
  "HTML tag" method in Search Console and paste the tag here.
- **Show the store in search engines:** leave on. Turn it off only before
  launch or on a test copy; while off, search engines are asked not to list
  any page.
- Changes reach the website within a few minutes. Search engines take days to
  weeks to show them.

### Size guides

- **Where:** `Products › Size guides`. A guide is a table of sizes and their
  measurements, typed in centimetres or inches. Shoppers can switch between
  cm and inches on the website.
- **Sizes** come from the shared **Size** option, so pick them from the list.
  A size that isn't a Size value is refused, which catches typos.
- **Set guides on categories**, not product by product: open the category and
  choose the guide in its **Size guide** box. Subcategories without their own
  guide use it too. Use a product's **Size guide** box only for exceptions.
- **Which guide a product shows**, in order: the one set on the product, then
  its category's (or the nearest parent category's), then the guide marked
  **Store default**. With none, the website hides the size guide link.
- **How to measure** text and an optional diagram appear above the table.
- Deleting a guide removes it from every product and category using it; they
  fall back as above.
- Store Managers can create and edit guides; Support and Marketing can view
  them.

### Coming soon and "Notify me"

- **Notify me** shows on the website for sold-out sizes and for products marked
  coming soon. Guests leave their email; signed-in customers just tap. Nobody
  is emailed until the item can actually be bought.
- **Coming soon:** open the product and turn on **Coming soon** in the
  **Notify me** box on the right. The product stays on the website but can't
  be bought. Keep it **Published**: a draft product is hidden from the website
  completely, so nobody can ask to be notified.
- **Launching:** add stock, then turn **Coming soon** off. Everyone waiting gets
  an "It's here" email within about 10 minutes, and the product shows a
  **New** badge on the website from that moment.
- **The New badge is automatic:** it lasts 30 days by default, counted from
  launch for coming-soon products, otherwise from when the product was created
  in the admin. Change the number of days under `Settings › Storefront` (Store
  Manager or Marketing).
  Publishing a draft does not restart it, so create products close to their
  release date, or use **Coming soon** to launch them.
- **Restocks:** just add stock. Everyone waiting on that size gets a "Back in
  stock" email within about 10 minutes. Each shopper is emailed once.
- The **Notify me** box shows how many people are waiting on each size, which
  helps decide what to reorder.
- Ticking "send me offers" when asking to be notified is the newsletter signup:
  they get the usual confirmation email and appear under
  `Settings › Newsletter` once they confirm. Customers can also switch offers
  on or off from their account.

### Customers, groups and exports

Customers and guest orders are under `Customers`. Use groups (VIP, stylists,
staff) to target promotions and price lists. Export orders and products to CSV
for bookkeeping. If a customer never received an email, a Super Admin can
check `Settings › Workflows` for the failed send.

Email retries reuse the same prepared message. A new password-reset link,
renewed invitation, partial refund or confirmed order edit is a separate
message. Verification emails show an expiry time in UTC; requesting a new
link is safer than using an old email that arrived late. If a send remains
failed, ask the developer to review it before repeatedly resending. See
[Email retry behavior](email-reliability.md) for technical limits.

## 5. Team roles

| Role                  | Can                                                                                                                 | Can't                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Super Admin           | Everything, including users, API keys and branding                                                                  | —                                                                |
| Store Manager         | Products, prices, stock, orders, customers, promotions, delivery, tax, regions                                      | Invite users, manage API keys, change branding or store identity |
| Support / Fulfillment | Orders, fulfilment and tracking, returns, refunds, customer details                                                 | Edit products or prices; any settings                            |
| Marketing             | Promotions, campaigns, price lists, collections and categories, newsletter, search & sharing and New badge settings | See orders, payments or customer records; change the brand       |

## 6. Known gaps

| Area                                     | Status        | Meanwhile                                                                                            |
| ---------------------------------------- | ------------- | ---------------------------------------------------------------------------------------------------- |
| Tracking on customer's order page        | Status only   | The shipping email carries the tracking link                                                         |
| Credo refunds                            | Manual        | Refund in the Credo dashboard; log the reference                                                     |
| Customer self-service returns            | Not built     | Customers contact support; you create the return                                                     |
| POS app                                  | Workaround    | Draft orders with a separate shop location                                                           |
| Gift cards, store credit, loyalty points | Not available | One-off promo codes as a substitute                                                                  |
| Abandoned-cart reminders                 | Built         | Settings › Bag reminders (see "Bag reminders")                                                       |
| Newsletter checkbox at checkout          | Not built     | The "Show opt-in at checkout" setting has no effect yet; the site's signup form and "Notify me" work |
| Newsletter success message               | Not shown     | The footer shows its own "Check your inbox" message after sign-up                                    |

## 7. Medusa guides

The official [Medusa Admin user guide](https://docs.medusajs.com/user-guide)
covers every screen. Where it disagrees with this handbook, follow the
handbook: it reflects this store's setup.
