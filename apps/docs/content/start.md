---
title: Using this handbook
---

# Using this handbook

This is the internal guide for the people who sell, support and maintain
YouJaymharah. Customer-facing journeys are documented so staff can reproduce
what a shopper sees. This site is not a substitute for the public store's
delivery, privacy or return policies.

## Choose your task

| You need to…                                          | Start with                                                                  |
| ----------------------------------------------------- | --------------------------------------------------------------------------- |
| Help someone who cannot pay, sign in or find an order | [Scenario index](/scenarios)                                                |
| Begin a shift                                         | [Daily operations](/staff/daily)                                            |
| Add stock or publish a product                        | [Catalog operations](/staff/catalog)                                        |
| Pack, ship, return or refund an order                 | [Fulfillment](/staff/fulfillment) and [refunds](/staff/refunds)             |
| Release an update or respond to an outage             | [Deployment](/operations/deployment) and [incidents](/operations/incidents) |
| Change the application                                | [Developer setup](/development/setup)                                       |
| Check an exact custom API contract                    | [API reference](/reference/generated/api)                                   |

## How to read a procedure

**Implemented** means the repository contains the behavior. **Manual** means a
person must complete the named action. **Configuration required** means the
feature depends on settings or an external service. **Verification required**
means someone must record a successful check in the target environment.

These distinctions matter: a refund form is not proof that a bank returned
money, and a passing HTTP health response is not proof that a customer can buy.
The [launch checklist](/operations/launch) records the evidence needed.

Use the latest deployed revision and its settings when investigating behavior.
An older audit or roadmap describes its own date, not necessarily today's
implementation. Detailed runbooks under Reference are imported from the
repository at build time; update the source file when correcting those pages.

## Working safely

Use an isolated test environment for rehearsals. Read the entire procedure
before changing a payment, order, inventory count or database. Record order and
gateway references in the appropriate internal ticket, never credentials or
customer data in this handbook.

Do not resolve uncertainty by charging, refunding or emailing again. Establish
the current provider and application state first. Escalate to the owner when
the two disagree or the required action exceeds your role.

## Verification

A completed task has an observable result: the expected customer page, order
state, provider receipt, delivered email or passing deployment check. Record
that result and any follow-up owner. If no guide covers a real case, add it to
the [scenario index](/scenarios) using the [documentation workflow](/development/documentation).
