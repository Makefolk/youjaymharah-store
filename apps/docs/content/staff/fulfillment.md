---
title: Fulfillment and delivery
---

# Fulfillment and delivery

**Audience:** fulfillment and Store Managers.

**Prerequisites:** a captured
payment, accurate items/address, suitable stock location, shipping profile and
courier arrangement. A gateway bank alert or pending authorization is not the
instruction to dispatch.

## Configure delivery before selling

Set the location's real address, fulfillment/service zones and shipping options.
Ensure each option covers the intended geography and product shipping profile.
The seed does not provide a complete shipping setup. Flat-rate options are the
initial supported path; calculated courier options need a working quote flow.

Test addresses in every advertised coverage area and one outside it. Verify
the actual charge and tax treatment. Publish delivery expectations and the
support contact before accepting orders.

## Pack and ship

1. Open the order and confirm captured payment, quantities, address and any
   support request that could affect dispatch.
2. Under unfulfilled items, create fulfillment for the intended quantities
   and location. Pick and inspect those items.
3. When the courier collects, mark the fulfillment shipped and record its
   tracking number and URL. Keep customer notifications enabled when appropriate.
4. When delivery is confirmed, mark delivered. Treat this as an irreversible
   business event rather than a convenient way to clear a queue.

For split shipments, repeat for each parcel's actual items. Do not mark the
entire order shipped when only one parcel left. Customer pages can show partial
progress and tracking for individual shipments.

## In-store and phone sales

**Audience:** shop staff and Store Managers. There is no till app; walk-in,
phone and WhatsApp sales are recorded as **draft orders**, which become normal
orders once converted.

**Prerequisites:** for walk-ins, a "Shop" stock location with its own stock, an
"In-store" sales channel linked to it, a ₦0 "Collected in store" or pickup
option, and a shop-owned email for customers who don't give theirs.

1. **Orders → Drafts → Create:** region Nigeria, the In-store sales channel (or
   the default channel for a delivered phone order), the customer's email or
   the walk-in email, and an address. Save.
2. Add items, any promo code and the delivery option: **Collected in store**
   for walk-ins, a normal delivery option for phone orders.
3. Take payment by cash, transfer or card terminal, and wait for the transfer
   alert or terminal approval before continuing.
4. **Convert to order.** The order confirmation is emailed as the receipt.
5. **Mark as paid**, with a note of the method and the terminal or transfer
   reference.
6. Walk-in: fulfil from the Shop location and **Mark as delivered**. Phone
   order: fulfil and ship as in [Pack and ship](#pack-and-ship).

**Result:** a paid order on the In-store channel, stock taken from the shop, and
a confirmation email at the address entered.

**Recovery:** a draft converted before payment stays unpaid; take payment then
mark it paid, or cancel the order if the customer leaves. Returns and exchanges
use the normal order screens; refund cash or transfers outside the store and
record them with the refund form.

**Verification:** at the end of the day, filter orders by the In-store channel
and date, and reconcile against the cash drawer, transfer alerts and the
terminal's report. Rehearse one counter sale before relying on it, checking the
stock count, the confirmation email and the order's payment status.

## Exceptions

| Situation                                | Procedure                                                                                                                        |
| ---------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Address change requested before dispatch | Verify the customer and whether fulfillment has begun; update through the supported order workflow and recheck shipping cost     |
| Address change after dispatch            | Contact the courier and manage it through support; a saved-account address change will not reroute the parcel                    |
| Cancellation requested                   | Check payment, fulfillment and refund status before using the supported cancel flow; cancellation does not itself prove a refund |
| Parcel missing/damaged                   | Preserve courier evidence, open/assign the support case and arrange the approved claim/replacement                               |
| Tracking link is wrong                   | Correct the fulfillment record and send a clear customer update; do not duplicate the shipment                                   |
| Paid order is overdue for shipment       | Assign an owner, investigate stock/courier blockers and give a realistic update                                                  |

## Verification

After each action, re-open the order and inspect fulfillment state, remaining
quantities, inventory/reservations, tracking and notification history. Rehearse
a partial shipment and a cancellation in test data. Use [returns/refunds](/staff/refunds)
when goods or money must be returned.
