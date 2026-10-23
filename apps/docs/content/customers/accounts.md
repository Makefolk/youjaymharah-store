---
title: Accounts and sign-in
---

# Accounts and sign-in

**Audience:** support and QA.

**Prerequisites:** working transactional email;
Google sign-in additionally requires its provider configuration and permitted
callback URL. Never ask a customer to send a password or recovery token.

## Register and verify

Customers can register with email/password, follow the verification email and
sign in. The password policy accepts 8–128 characters. Encourage a unique
password. If the verification email is missing, check spam and the recipient
address, then use the supported resend action and respect its rate limit.

Do not manually mark an address verified simply because someone knows the
customer's name or order number. Verification proves inbox access.

## Google sign-in

Start through the storefront's Google button. The callback is bound to the
browser that started sign-in and has a short-lived state cookie. If the flow
expires, open a fresh sign-in attempt rather than replaying an old callback.

An existing unverified password identity cannot be silently attached to a Google
identity. The customer should recover and verify the existing account through
the supported flow. Escalate mismatched accounts; do not merge identities by
editing email fields or database rows.

## Password recovery and other devices

Use **Forgot password**, receive the reset link in the account inbox and choose
a new password. Expired or already-consumed links need a new request. A password
reset/change ends earlier sign-ins through the session-revocation mechanism;
test the deployed behavior after applying its migration.

Use the account's supported password-change and sign-out-all-devices controls
for an authenticated recovery. Ordinary sign-out clears this browser's cookies
and is different from ending every issued credential. If compromise is
suspected, follow [security incident handling](/operations/security).

## Profile and saved details

Customers can update profile details, manage saved addresses, inspect order
history and adjust marketing preferences. Changing a saved address does not
change the delivery address on an existing order. Existing-order changes go
through support and must be completed before fulfillment where possible.

| Symptom                                             | Recovery                                                                                         |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Sign-in stops working after password recovery       | Sign in again with the new credential; old tokens should be refused                              |
| Too many attempts                                   | Wait for the retry interval; staff should not bypass abuse controls                              |
| Account page returns a temporary availability error | Check backend/database readiness, then retry                                                     |
| Google button is unavailable                        | Check whether the provider is configured and exposed in settings                                 |
| An extra verification/MFA step has no usable screen | Escalate to engineering; do not disable security globally to complete one login                  |
| Order history is empty                              | Confirm the account/email and guest-order association without exposing another customer's orders |

## Verification

Exercise registration, verification, password reset, account login and Google
login on fresh sessions. Confirm a reset invalidates an older credential, one
customer cannot read another customer's data, and address changes do not alter
placed orders. Test marketing preferences independently of sign-in.
