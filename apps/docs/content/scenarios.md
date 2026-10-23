---
title: Scenario index
---

# Scenario index

Use this index for implemented customer journeys, staff procedures and known
failure paths. The linked guides explain prerequisites, expected results and
recovery. External provider behavior and business settings still need acceptance
testing in the target environment; no finite checklist covers every possible
incident.

## Customer journeys

| ID  | Situation                                                          | Procedure                                   |
| --- | ------------------------------------------------------------------ | ------------------------------------------- |
| C01 | Browse a category, collection or new arrivals                      | [Catalog](/customers/catalog)               |
| C02 | Search, filter, sort or get no results                             | [Catalog](/customers/catalog)               |
| C03 | Select a color/size, view a size guide or encounter sold-out stock | [Catalog](/customers/catalog)               |
| C04 | Add, change or remove bag items                                    | [Checkout](/customers/checkout)             |
| C05 | Apply an invalid, expired or ineligible promotion                  | [Checkout](/customers/checkout)             |
| C06 | Check out as a guest or use a saved address                        | [Checkout](/customers/checkout)             |
| C07 | Address has no delivery option or delivery loading fails           | [Checkout](/customers/checkout)             |
| C08 | Pay successfully with Paystack or Credo                            | [Payments](/customers/payments)             |
| C09 | Cancel payment, decline a card or wait for a bank transfer         | [Payments](/customers/payments)             |
| C10 | Money left the bank but no order is visible                        | [Payments](/customers/payments)             |
| C11 | Close the browser, lose the bag cookie or revisit a callback       | [Payments](/customers/payments)             |
| C12 | Register, verify email or sign in with a password                  | [Accounts](/customers/accounts)             |
| C13 | Sign in with Google or resolve an account-linking problem          | [Accounts](/customers/accounts)             |
| C14 | Reset/change a password or end other sign-ins                      | [Accounts](/customers/accounts)             |
| C15 | Manage profile, addresses and preferences                          | [Accounts](/customers/accounts)             |
| C16 | Find an order, open an expired link or track a partial shipment    | [After purchase](/customers/after-purchase) |
| C17 | Request a return, miss the return window or await a refund         | [After purchase](/customers/after-purchase) |
| C18 | Request cancellation, address change, exchange or damage help      | [After purchase](/customers/after-purchase) |
| C19 | Start/reply to a support conversation with photos                  | [After purchase](/customers/after-purchase) |
| C20 | Save a guest wishlist and sign in later                            | [Subscriptions](/customers/subscriptions)   |
| C21 | Subscribe, confirm, unsubscribe or manage offers                   | [Subscriptions](/customers/subscriptions)   |
| C22 | Receive a stock alert or restore/stop a bag reminder               | [Subscriptions](/customers/subscriptions)   |

## Staff operations

| ID  | Situation                                                       | Procedure                                              |
| --- | --------------------------------------------------------------- | ------------------------------------------------------ |
| S01 | Start/end a shift and assign outstanding work                   | [Daily operations](/staff/daily)                       |
| S02 | Invite staff, choose a role or remove access                    | [Roles](/staff/roles)                                  |
| S03 | Create products, variants, prices and stock                     | [Catalog operations](/staff/catalog)                   |
| S04 | Correct an image, size guide, category or collection            | [Catalog operations](/staff/catalog)                   |
| S05 | Sell the last unit, manage backorders or correct stock          | [Catalog operations](/staff/catalog)                   |
| S06 | Create a promotion or inspect a discounted total                | [Catalog operations](/staff/catalog)                   |
| S07 | Configure shipping coverage/rates and fulfill an order          | [Fulfillment](/staff/fulfillment)                      |
| S08 | Ship partially, add tracking or mark delivery                   | [Fulfillment](/staff/fulfillment)                      |
| S09 | Handle an unshipped, lost, damaged or canceled order            | [Fulfillment](/staff/fulfillment)                      |
| S10 | Receive a return or arrange an exchange/claim                   | [Returns and refunds](/staff/refunds)                  |
| S11 | Record a full/partial Paystack or Credo refund                  | [Returns and refunds](/staff/refunds)                  |
| S12 | Recover an ambiguous or duplicate refund record                 | [Returns and refunds](/staff/refunds)                  |
| S13 | Triage, assign, reply to or resolve support                     | [Support inbox](/staff/support)                        |
| S14 | Keep staff notes private and handle photo/access problems       | [Support inbox](/staff/support)                        |
| S15 | Update branding, navigation, policies or the homepage           | [Content and marketing](/staff/content)                |
| S16 | Schedule an announcement or configure newsletter/reminders      | [Content and marketing](/staff/content)                |
| S17 | Investigate missing email, bounce, complaint or retry ambiguity | [Email delivery](/staff/email)                         |
| S18 | Find a payment and recover a paid bag with no order             | [Payment recovery](/customers/payments#staff-recovery) |

## Production and development

| ID  | Situation                                                  | Procedure                                   |
| --- | ---------------------------------------------------------- | ------------------------------------------- |
| O01 | Prepare the first production launch                        | [Launch acceptance](/operations/launch)     |
| O02 | Deploy, migrate or roll back a release                     | [Deployment](/operations/deployment)        |
| O03 | Storefront returns errors while liveness is healthy        | [Incidents](/operations/incidents)          |
| O04 | Database, Redis, queue or worker stops working             | [Incidents](/operations/incidents)          |
| O05 | Gateway, email or object storage is unavailable            | [Incidents](/operations/incidents)          |
| O06 | Restore a backup or reconcile work after recovery          | [Recovery](/operations/recovery)            |
| O07 | Handle compromised access, private files or a data request | [Security](/operations/security)            |
| O08 | Publish internal docs behind authentication                | [Docs hosting](/operations/docs-hosting)    |
| D01 | Set up development and isolated tests                      | [Setup](/development/setup)                 |
| D02 | Add an API, workflow, model, job or storefront feature     | [Architecture](/development/architecture)   |
| D03 | Regenerate contracts and verify a release                  | [Testing](/development/testing)             |
| D04 | Configure a service or debug a missing variable            | [Configuration](/development/configuration) |
| D05 | Add a scenario or update a generated reference             | [Documentation](/development/documentation) |

## Features requiring manual work or additional implementation

Self-service exchanges/claims, courier integrations, automatic refund
reconciliation, POS, gift cards/store credit, loyalty, product reviews and
international checkout are not promises made by this handbook. Use the named
manual procedure where one exists. The current storefront is designed for
Nigeria/NGN. Enable new business offerings only after their customer and
operator scenarios have been implemented and accepted.
