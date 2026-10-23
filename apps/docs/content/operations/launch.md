---
title: Launch acceptance
---

# Launch acceptance

**Audience:** owner, Store Manager and release operator.

**Prerequisites:** an
identified release revision, isolated staging, named business/technical owners
and approved public policies. Mark an item complete only with evidence from
the target environment; repository code alone does not prove configuration.

## Business and configuration gate

| Check                    | Evidence to record                                                                            |
| ------------------------ | --------------------------------------------------------------------------------------------- |
| Catalog and stock        | Published products, correct variants/images/prices, real stock and location address           |
| Delivery                 | Successful checkout for each supported geography; unsupported addresses handled correctly     |
| Tax and promotions       | Approved pricing treatment and correctly calculated representative totals                     |
| Payments                 | Correct gateway modes, callbacks/webhooks and verified amount/currency                        |
| Test-provider protection | A direct production Store API request for manual/test payment is refused                      |
| Customer communication   | Working support contacts, response ownership and approved delivery/return/privacy/terms pages |
| Email                    | Verified sender/domain, delivery, bounce and signed-webhook checks                            |
| Identity                 | Password recovery, verification, Google callback where enabled and staff access controls      |
| Storage                  | Product images load; private customer attachments require authorization                       |

## Customer and staff acceptance gate

Rehearse the [scenario index](/scenarios) in staging. At minimum, record guest
and account purchases through each enabled gateway, canceled and delayed
payments, a timeout/lost cookie, competing last-unit orders, promotions/tax,
partial fulfillment, tracking, return receipt and full/partial refund.

Complete one customer/staff support exchange with a photo, an internal note,
assignment and resolution. Verify another customer cannot see the thread,
attachment or order. Test old credentials after password recovery and expired
guest links. Check mobile layout, keyboard navigation, error messages and image
loading on the real build.

## Technical and operational gate

- CI, API-codegen freshness, migrations and both application builds pass on the
  release revision. Include the docs build when procedures change.
- The backend readiness check passes and the storefront renders usable pages.
  Storefront liveness alone is insufficient.
- Redis-backed retries and a worker restart recover unfinished work without
  duplicate payment, order, refund or email side effects.
- Backups and an isolated restore are verified, with agreed recovery targets.
- External probes, worker/backlog checks and resource alerts reach a named owner.
- Private application ports, trusted proxy handling, TLS and credentials are
  configured. Internal docs and staging require access controls.
- Existing uncertain payments/refunds and email records are reconciled before
  rolling out changes to their ledgers or persisted workflows.

## Release record

Record revision/image tags, migration result, acceptance evidence, approved
manual procedures, remaining limitations, alert destination and rollback owner
in the release system. Do not record secrets in the handbook. A small launch can
use manual courier work and dashboard-first refunds when trained staff own them.
Do not advertise unsupported self-service or international features.

## Failure or rollback

If a gate fails, identify whether the cause is code, configuration or an
external outage. Keep checkout unavailable when payment correctness cannot be
established. Follow [deployment](/operations/deployment) for rollback and
[incidents](/operations/incidents) for communication and recovery.
