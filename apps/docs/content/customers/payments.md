---
title: Payments and recovery
---

# Payments and recovery

**Audience:** support, finance/owner and QA.

**Prerequisites:** the customer's
order or payment reference, the appropriate admin permissions, and gateway
dashboard access when reconciliation is needed. Never request a card number,
PIN, OTP or gateway password from a customer.

## Successful payment

The shopper pays on Paystack or Credo, then returns to the storefront. The
backend verifies payment before completing the bag. Webhooks can arrive before
or after the browser returns. Repeating a completion for an already completed
bag must resolve to the same order.

Confirm the order, the captured payment and the confirmation email before
fulfillment. A screenshot or bank alert alone is not gateway verification.

## Cancellation, decline and pending transfers

| Situation                                               | Customer guidance                                             | Staff check                                                                |
| ------------------------------------------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Customer canceled or card was declined                  | Review the gateway result and return to checkout              | No successful payment exists before another attempt                        |
| Bank transfer is still pending                          | Allow the payment to settle; do not immediately pay again     | Gateway reference and payment status                                       |
| Money left the account but confirmation is missing      | Keep the reference and contact support                        | Gateway payment, Medusa payment session and order association              |
| Callback failed or browser timed out                    | The result may be unknown; avoid another charge until checked | Verify with the gateway and look for an existing order                     |
| Cookie is missing or payment happened on another device | Check the confirmation email or use Find my order             | Verify inbox ownership; do not disclose details from an order number alone |
| Customer revisits the callback                          | Check for the existing confirmation/order                     | Do not create a second order manually without reconciliation               |

## Staff recovery

1. Search **Payment lookup** using the gateway reference. Also inspect Orders
   and the **Attention** panel for the related payment/bag.
2. Compare provider, transaction reference, currency and exact amount. Identify
   whether Medusa already has an order and whether inventory can still fulfill it.
3. If the gateway confirms payment and no order exists, use the supported
   **Create order** recovery action. Recheck for an order if the action times out.
4. If amounts/currency differ, payment is ambiguous, or fulfillment cannot be
   completed, escalate to the owner. A refund is a separate controlled action.
5. Record the resolution and contact the customer through the support thread.
6. In **Attention**, a payment that became an order clears itself on the next
   check. For one resolved outside the store, such as a gateway refund for a
   different amount, use **Mark handled** and write what was done. The note is
   kept with the staff member's name. Marketing cannot do this; staff with
   order access can.

Attention labels each payment **Paid, no order**, **Paid a different amount**,
**Not finished** (still being rechecked) or **Unfinished for a week** (pending
or uncheckable for seven days). Treat the last as a manual gateway check.

The reconciliation job keeps payment checks in the database and runs every five
minutes. It begins checking attempts after a 20-minute grace period, retries
pending/unknown results with backoff and escalates unresolved attempts after
seven days. Its first run looks back seven days; older attempts need a manual
review. A worker restart must retain queued checks.

The attention panel is an aid, not a settlement statement. Assign an operator
to compare gateway settlements with orders and verify reconciliation in the
target environment. Include older attempts and multiple references for one
bag; the newest attempt is not necessarily the one that was paid.

## Refunds and duplicate payments

Do not initiate another charge or refund to discover the outcome of the first.
For a duplicate payment, first identify which reference funds the actual order.
Use the [refund procedure](/staff/refunds) for any amount that must be returned.
Customer notifications do not prove that a bank has completed settlement.

## Verification

In test mode, cover success, cancellation, decline, delayed transfer,
duplicate/reordered webhooks, a repeated callback, no cart cookie, a network
timeout and a paid bag that cannot complete due to stock. Record gateway and
application outcomes without copying sensitive provider payloads into the docs.
Manual/test payment providers must be rejected by the production Store API.
