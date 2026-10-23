---
title: Content and marketing
---

# Content and marketing

**Audience:** marketing, merchandising and authorized settings owners.

**Prerequisites:** approved copy/media, correct role and a way to preview the
customer journey. Do not publish an operational promise the team cannot meet.

## Storefront settings

Use the relevant Settings pages to maintain branding, support contacts,
homepage hero and About section, featured collection, navigation cards, SEO/social information,
new-product badge age, return policy and delivery/support information. About,
Privacy and Terms need real approved content; an empty page is not a completed
policy.

After saving, inspect the actual storefront. Cache invalidation requires the
shared backend/storefront secret and a reachable endpoint. If immediate refresh
fails, time-based caching may delay the visible change. Do not repeatedly save
different values before establishing which version is being served.

Hero history supports reviewing/restoring prior versions. Verify the restored
image/video, mobile layout, text and call-to-action destination. Removing a
media asset can break both current and historical versions that refer to it.

## Homepage About section

Go to **Settings → Storefront → Homepage About → Edit**. The owner, Marketing
and Store Manager can edit this content; Support can read it. Starter copy is
provided and can be replaced at any time.

1. Set the small heading, heading and introduction. A line break in the heading
   is preserved; a blank line in the introduction starts a new paragraph.
2. Optionally upload a portrait PNG, JPEG or WebP image up to 10 MB. Add a brief
   image description for screen readers. Without a photo, the section displays
   a brand panel using the store name and uploaded logo.
3. Set both the link label and destination, or clear both to remove the link.
   The starter link goes to `/products`. Use `/about` only after publishing that
   page in **Settings → Pages**.
4. Turn **Show on homepage** on and save. The heading and introduction are
   required while visible. Turn it off to hide the whole section while keeping
   the editor’s content for later.
5. Check the homepage below the collections on desktop and mobile. Verify the
   image crop, paragraph breaks and link destination. Removing the photo restores
   the brand panel; hiding the section leaves no empty block.

This introduction and the full About page have separate content. Hero history
does not store About revisions. Keep approved copy outside the editor if you
need to restore an earlier version.

## Announcements and campaigns

Use valid internal destinations or approved external links. Check scheduling,
start/end times, priority and mobile layout. The [announcement reference](/reference/generated/announcements)
describes the supported combinations. Test a campaign's promotion in the bag,
not just its banner text.

## Newsletter, reminders and product alerts

Configure newsletter enablement, audience, double opt-in, headings, consent,
reply-to and checkout opt-in. Ensure the selected external audience exists and
the sender is ready. The displayed success copy can differ between entry points;
verify the actual UI before handing copy to marketing.

On the storefront, signup appears in a centered section immediately above the
footer, including on pages other than the homepage. **Settings → Newsletter**
still controls its heading, description, consent and enablement. Turning signup
off hides the whole section. Existing subscriber attribution continues to use
`footer`. Check mobile layout, invalid email feedback and confirmation behavior
after editing the copy; moving the form does not change the subscription rules.

Bag reminders have configurable delays and enablement. Product alert delivery
depends on stock/release eligibility and scheduled workers. Test confirmation,
unsubscribe, reminder stop and product-specific opt-out behavior. Do not turn
on marketing flows simply because their settings screen is present.

## Search and discoverability

Maintain approved search vocabulary, synonyms and fallback/trending terms.
Do not publish raw customer search phrases. Check page titles, descriptions,
sharing images, robots and sitemap output on the intended environment.
Staging and internal docs must remain protected/non-indexable independently of
the storefront's live SEO setting.

## Verification and recovery

Inspect desktop/mobile pages, keyboard navigation, links, image loading and
checkout eligibility. Restore the previous content revision or disable the
specific campaign if it is wrong. For stale content, use [incident diagnostics](/operations/incidents)
instead of clearing unrelated Redis data or disabling security controls.
