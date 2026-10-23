---
title: Bags, delivery and checkout
---

# Bags, delivery and checkout

**Audience:** support and QA.

**Prerequisites:** purchasable stock, a valid NGN
price, a configured delivery option for the customer's address and an enabled
gateway. Guest checkout is supported.

## Normal journey

1. Add the intended color/size to the bag. Review quantity and remove unwanted
   items. Apply a promotion code if eligible.
2. Enter the customer's email and Nigerian delivery details, or choose a saved
   address when signed in. Billing uses the delivery address in this checkout.
3. Select an available delivery option and check its price. Review the complete
   order total, including discounts, delivery and tax.
4. Select Paystack or Credo and continue to its hosted payment page.
5. Follow [payment confirmation and recovery](/customers/payments).

Newsletter consent is a separate optional choice when enabled. Buying does not
require opting in to marketing.

## Promotion and stock failures

A code can fail because it expired, does not match the items/customer, has a
minimum spend, exhausted its usage limit or conflicts with another promotion.
Staff should inspect the promotion's actual conditions rather than promise a
discount from the code name. Verify the final calculated total after applying
or removing a code.

If inventory changes, reduce the quantity or choose an available variant. Do
not disable inventory tracking merely to force an order through. If payment
has already occurred, use payment recovery before attempting a fresh purchase.

## Delivery failures

| Situation                                 | Action                                                                                 |
| ----------------------------------------- | -------------------------------------------------------------------------------------- |
| Address is incomplete or state is wrong   | Correct the address, then reload options                                               |
| No option covers the address              | Staff check service zone, shipping profile, location and option rules                  |
| Options fail to load                      | Check connectivity and store readiness; retry before declaring the address unsupported |
| Customer requests an unlisted destination | Use support; do not invent a shipping price or imply international checkout exists     |
| A calculated carrier price is missing     | Do not treat it as free delivery; enable only a shipping flow the storefront supports  |

Configured flat-rate options support the initial launch. A carrier integration
requires its calculated-quote and fulfillment behavior to be implemented and
tested before staff enable it.

## Bag and browser behavior

The active bag is associated with the browser. Private browsing, deleting
cookies or switching devices can lose that association. Sign-in can transfer
the current guest bag, but customers should review it after signing in. After
successful completion, adding another item starts a new bag.

## Verification

Test one supported and one unsupported address, a valid and invalid promotion,
a last-unit stock change, guest and account checkout, and an empty bag. Verify
the backend order total matches the amount sent to the gateway. Continue with
the cancellation, timeout and delayed-transfer cases in [payments](/customers/payments).
