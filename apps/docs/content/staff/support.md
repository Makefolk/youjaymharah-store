---
title: Support inbox
---

# Support inbox

**Audience:** support and the shift lead.

**Prerequisites:** permitted staff
account, response target, escalation owner and verified customer/order context.

## Triage and assignment

Open **Support inbox**, identify the topic and related order/customer, set a
priority and assign an owner. Check existing conversations and order actions
before starting another process. Requests include general questions, delivery,
returns, cancellation, address changes, exchanges, damaged and missing items.

| State             | Meaning                                          | Next action                                                        |
| ----------------- | ------------------------------------------------ | ------------------------------------------------------------------ |
| Open              | Waiting on staff                                 | Assign, investigate and reply                                      |
| Awaiting customer | The team replied and is waiting for the customer | Follow the response policy; do not assume silence means resolution |
| Resolved          | The matter is complete                           | A new customer reply reopens it                                    |

High priority is a staff signal, not an automatic response-time guarantee.
Until SLA automation is configured and verified, the shift lead reviews overdue
and unassigned work manually.

## Replies and internal notes

Read the complete thread and relevant order/payment state. Send a concise
customer reply stating the verified outcome or next action. Use an **internal
note** for staff-only investigation; it must not be included in the public
thread or customer email. Check the selected mode before sending.

A reply email directs the customer to their thread. Do not promise that replying
directly to an email will append to the thread unless inbound-email integration
has been implemented and tested. Refresh the thread when checking for new work;
do not assume a live-chat subscription exists.

## Acting on an order request

Cancellation, address changes, exchanges, claims and refunds must be performed
through the appropriate order workflow. The ticket records communication; it
does not perform the operation. Verify identity/access before disclosing order
details or changing delivery instructions. Use [fulfillment](/staff/fulfillment)
and [refunds](/staff/refunds) for those actions.

## Photos, links and private data

Request only evidence needed for the issue. Photos can include addresses or
receipts; keep them within the protected support flow. Do not upload them to a
public image service or paste signed access links into general chat.

Customer photos are stored in a private bucket and are shown only in the
inbox, to the signed-in customer and to the holder of the request's link.
Location and camera data is removed when they are uploaded. Staff emails say
how many photos arrived instead of including them; open the request to see
them. In production, photos are refused until the private bucket
(`SUPPORT_FILES_BUCKET`) is configured.

Emailed request links work for 90 days, and every email carries a fresh one.
If a link was forwarded or leaked, use **Cancel guest links** on the request.
Earlier links stop working; the signed-in owner keeps access, your next reply
sends a new link, and the customer can request one from the expired page. That
request emails only the request's own address.

If an attachment fails, check file type/size, access expiry and storage
availability. If a customer loses access, use a verified reissue/recovery flow.

## Close and verify

Confirm the promised order/refund action actually occurred, send the outcome
and mark the request resolved. Check customer-facing visibility and email
delivery. Rehearse internal-note isolation, another customer's denied access,
photo authorization and reopening a resolved request. Use [email review](/staff/email)
when a notification's outcome is uncertain.
