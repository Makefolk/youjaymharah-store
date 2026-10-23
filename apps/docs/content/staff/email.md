---
title: Email delivery and review
---

# Email delivery and review

**Audience:** support, the owner and operators.

**Prerequisites:** permitted
admin access, working sender/domain configuration and provider access for
ambiguous delivery. Customer notification payloads may contain private data.

## Normal delivery

Order, shipping, delivery, return/refund, support and account events can trigger
transactional email. The application keeps delivery/retry evidence and provides
order email history plus **Email review** for uncertain outcomes. Marketing and
product/reminder flows have their own eligibility and subscription state.

An accepted message is not necessarily delivered. A provider message ID, a
delivery event and a customer's actual inbox are different pieces of evidence.

## Investigate a missing email

1. Confirm the intended recipient and that the underlying order/account action
   occurred. Do not change the recipient just to work around a delivery issue.
2. Inspect order email history or the relevant notification/review record.
3. Check provider acceptance, delivery, bounce, complaint and webhook state.
4. If the message was delivered, ask the customer to check spam and filtering.
   If it bounced, resolve the address/provider issue through the supported flow.
5. Use a deliberate resend action only when the current state supports it.

## Uncertain acceptance and review

A timeout can mean the provider accepted the email but the app did not receive
its response. Follow the [email reliability runbook](/reference/generated/email-reliability)
to compare the idempotency key, provider evidence and review record. Its retry
window is bounded; an old uncertain send must not be blindly retried.

Use **Email review** to resolve cases with the available evidence. Resending an
order confirmation or shipping email is a new intentional action with its own
record. Do not restart workers repeatedly or delete ledger rows to force mail.

## Provider and webhook failures

| Symptom                            | Check                                                                              |
| ---------------------------------- | ---------------------------------------------------------------------------------- |
| All sends fail                     | Provider outage, key validity, sender/domain and quota                             |
| Sends accepted but status is stale | Webhook URL, signing secret, receipts and reconciliation job                       |
| Only marketing fails               | Audience configuration, consent, subscription sync and eligibility                 |
| Review queue grows                 | Worker health, retry deadlines and assigned review owner                           |
| Duplicate messages reported        | Compare deliberate resends with retry/idempotency records before changing behavior |

## Verification

Use isolated recipients and test credentials for automated checks. Rehearse
accepted delivery, hard bounce, duplicate webhook, bad signature, provider
timeout and delayed reconciliation. Confirm no staff role can retrieve reset or
invitation credentials from the notification feed. Follow the [webhook reference](/reference/generated/resend-webhooks)
for setup and recovery details.
