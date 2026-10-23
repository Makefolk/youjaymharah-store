---
title: Orders, returns and support
---

# Orders, returns and support

**Audience:** support and QA.

**Prerequisites:** a signed-in owning account or a
valid guest link, configured support contact details and the applicable return
policy. Order numbers alone are not identity proof.

## Find and track an order

Signed-in customers use order history. Guests use the link in an order email or
the **Find my order** flow. The protected flow sends a fresh link to the order's
email when the supplied details match; it should not disclose whether another
person's email has ordered. An expired link needs a new email or owner sign-in.

The order page shows progress, items and shipment tracking where provided.
Partial fulfillment/shipping means only some items have reached that stage.
Check each shipment rather than assuming one tracking number covers the entire
order. A customer can follow the courier's link when staff recorded it.

## Request a return

1. Open the order's return action while returns are enabled.
2. A guest obtains the additional emailed return proof when requested.
3. Select eligible items, quantities and reasons, then submit once.
4. Follow the instructions supplied by the team. A request is not a refund and
   does not itself mean that goods have been received.

Eligibility depends on the configured window, order/item state and quantities
already returned or requested. Do not alter timestamps or quantity records to
override policy. Staff decide exceptions through the supported admin workflow.

## Cancellation, address change, exchange or damaged goods

Use the order's **Get help** action and choose the relevant topic. These actions
create a support request; staff must perform any actual cancellation, address
update, exchange, claim or refund. Sending a request does not reserve replacement
stock or stop an already shipped parcel.

For damage, missing or wrong items, request only the photos needed to establish
the problem. Avoid asking for identity documents or full bank/card details.

## Support conversation

Customers can use Contact, order help, their account support list or an emailed
thread link. They can read staff replies and send another message. Staff-only
notes must never appear in this view. A customer reply to a resolved request
reopens it for staff attention.

The upload interface supports up to three JPEG, PNG or WebP photos, with the
configured size limit. If an image is refused, use a smaller valid image. If a
link or photo cannot be opened, verify access and storage status rather than
asking the customer to publish a private image elsewhere.

| Situation                                           | Recovery                                                                |
| --------------------------------------------------- | ----------------------------------------------------------------------- |
| Order/support link expired or was forwarded         | Reissue through the verified inbox or use the owning account            |
| Return action unavailable                           | Check policy, dates, item eligibility and previous requests             |
| Parcel is late or tracking is missing               | Staff inspect shipment records and contact the courier                  |
| No staff response yet                               | Check assignment and response target in the support inbox               |
| Refund appears in Medusa but bank credit is missing | Check the original gateway refund receipt; follow its settlement status |

## Verification

Test owner and guest flows, expired/wrong access, two customers' isolation,
partial shipments, duplicate return attempts, internal-note privacy and a
customer reply after resolution. Use [support operations](/staff/support) and
[returns/refunds](/staff/refunds) for the staff side of the same journey.
