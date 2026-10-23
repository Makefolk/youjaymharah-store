---
title: Wishlists and subscriptions
---

# Wishlists and subscriptions

**Audience:** support, marketing and QA.

**Prerequisites:** relevant settings
enabled, working email and scheduled workers. Each subscription has its own
purpose; do not treat a saved product as permission for unrelated marketing.

## Wishlists

Guests save products in a browser-associated wishlist. Signing in merges the
guest list into the customer's account list. A saved entry can remember the
chosen variant. Deleting browser cookies can lose a guest list; stale guest
lists are cleaned up after the configured retention period.

A saved item is not an inventory reservation. If it is unpublished or sold
out, explain the current availability instead of promising the saved price or
size. Verify duplicate saves and account merging do not produce duplicate
entries or expose another customer's list.

## Newsletter and offers

Sign-up can appear in its own section just above the footer and at checkout when staff enable it. A double
opt-in configuration sends a confirmation link before the contact becomes
subscribed. The customer may supply the required profile details during
confirmation. They can unsubscribe through the email link or adjust supported
account preferences.

If confirmation is missing, inspect email delivery and subscription state.
Do not repeatedly subscribe someone to force another email. A pending contact
must not be treated as confirmed when double opt-in is enabled. An unsubscribe
must propagate to the external email audience; reconciliation handles retries.

## Product alerts

Customers may request an available restock or launch notification. A variant
subscription applies to the selected size/color where supplied. Delivery
depends on the product becoming eligible, the worker running and the email
provider accepting the message. An alert is not a stock reservation or a
guaranteed restock date.

## Bag reminders

When configured, a reminder can help a customer restore an eligible unfinished
bag. Its link may stop working when the bag is completed, the token expires or
the reminder is stopped. Review the restored items and current prices/stock
before paying; the old email is not a price guarantee.

The stop link opts out of that reminder flow. It should not be confused with
newsletter preferences. Marketing staff configure delays and enablement in
**Settings › Bag reminders**.

## Verification and recovery

Test guest/account wishlist merge, newsletter confirmation and unsubscribe,
checkout opt-in, a product becoming available, a reminder restore and stop.
Inspect delivery/sync state when emails do not arrive. Use [email review](/staff/email)
for ambiguity and [content/marketing settings](/staff/content) for configuration.
