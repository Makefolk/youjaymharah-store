---
title: Returns, claims and refunds
---

# Returns, claims and refunds

**Audience:** authorized support, Store Managers and the owner.

**Prerequisites:** verified order/customer, applicable policy, actual returned
quantities where relevant, gateway receipt and refund permission. Refunds move
money and must not be repeated to resolve an uncertain response.

## Receive a return

1. Find the customer's requested return on the order. Verify items, quantities,
   reasons and policy. A request is not evidence of receipt.
2. Arrange the approved return/shipping process and communicate instructions.
3. Receive and inspect the actual goods through the admin workflow. Record
   the condition and correct inventory disposition.
4. Decide the approved refund/replacement outcome and perform it separately.

Exchanges and damaged/missing-item claims require staff work. The customer's
support request does not reserve replacement stock or create an exchange by
itself. Use native admin exchange/claim tools and verify any additional payment
or refund and inventory changes.

## Paystack refund

1. Open the original transaction in Paystack and initiate the approved amount
   there. Keep its numeric refund ID.
2. Wait until the gateway reports **Processed**. A pending/processing state is
   not yet eligible for recording as completed.
3. On the Medusa order, use **Gateway refunds › Record refund**. Enter the exact
   amount and refund ID, with an internal reason/reference as appropriate.
4. The backend checks the refund against the original transaction, currency and
   amount before recording it. Reused IDs and mismatches are refused.
5. Confirm the Medusa balance/refund record and customer notification. Bank
   settlement timing remains a provider matter.

## Credo refund

Refund in the Credo dashboard first, verify its completion there and record the
exact amount/reference using the order's gateway refund control. The current
integration cannot independently confirm Credo refund completion through its
API. The staff member must verify the dashboard evidence. Reference deduplication
does not replace this check.

## Partial, duplicate or ambiguous refunds

For partial refunds, compare the remaining refundable balance with all previous
gateway and Medusa refunds. Each gateway refund reference can be recorded once.

If recording fails after the gateway returned money, **do not refund again**.
Compare the original gateway transaction, refund receipt, refund ledger and
Medusa refund records. Escalate a surviving ledger claim or inconsistent record
to the owner/engineering. Do not delete a claim merely to make the button work.
Historical untracked refunds require reconciliation before new recording.

The ordinary Medusa refund button is not the gateway-transfer workflow in this
project. Cancellation, return receipt, refund initiation and refund completion
are separate events. Customer emails should reflect the verified outcome.

## Verification

Rehearse full and partial refunds, pending/failed provider states, wrong
transaction/currency/amount, repeated IDs and interrupted recording in isolated
tests. Confirm customer-facing totals, stock, role permissions and notification
history after each approved action.
