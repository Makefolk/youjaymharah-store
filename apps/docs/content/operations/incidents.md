---
title: Monitoring and incidents
---

# Monitoring and incidents

**Audience:** operators and the incident owner.

**Prerequisites:** access to
sanitized logs/metrics, deployed revision information and the approved service
dashboards. Establish one incident owner and a customer-communication owner.

## First response

Record the start time, affected journeys, environment and current revision.
Check whether the incident began with a deploy or external outage. Preserve
evidence without copying cookies, access links, request bodies or credentials.
Use read-only checks before changing application state.

| Symptom                                   | Check first                                                                        | Recovery direction                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Storefront liveness passes but pages fail | Rendered page, storefront readiness, backend readiness, publishable key and region | Restore dependencies/configuration; verify real pages before closing         |
| Backend readiness fails                   | Database and Redis results, connection limits and network                          | Repair the dependency, then verify worker/request processing                 |
| Jobs stop while HTTP works                | Worker process, heartbeat, oldest pending work, queue/Redis state                  | Restore worker operation; replay only through the durable workflow mechanism |
| Redis writes fail or memory rises         | Memory limit, disk, AOF and queue growth                                           | Add capacity/resolve backlog; do not enable eviction or flush queues         |
| Payments arrive but orders do not         | Gateway references, webhook receipts, completion errors and stock                  | Assign settlement reconciliation and use payment lookup                      |
| Emails stall or duplicate                 | Ledger/review state, provider status and webhook processing                        | Follow the email runbook; do not blindly resend                              |
| Images or attachments fail                | Storage availability, host allowlist, authorization and signed-link expiry         | Restore storage/access; do not make private files public                     |
| Admin changes look stale                  | Revalidation secret/endpoint and cache age                                         | Repair invalidation; avoid flushing unrelated Redis data                     |

## Monitoring coverage

Use external checks for both backend and storefront, including a usable page
or synthetic catalog path. GitHub's scheduled uptime workflow is a backstop,
not a precise continuous monitor. Configure the required URLs and verify that
an actual failure reaches the intended recipient.

Monitor worker heartbeats, backlog age, failed/retrying jobs, unpaid/paid-order
exceptions, email review age, database connections, Redis memory, disk and
container restarts. Process liveness is not evidence that business work is
progressing. Establish expected thresholds and an on-call owner before launch.

## Containment

Pause affected business actions when their outcome cannot be trusted. Preserve
existing payment/refund state and pending jobs. If a deploy caused the failure,
use a compatible rollback. Never clear locks, flush Redis, delete ledger rows
or rerun seeds as a generic recovery step.

For suspected account or private-data exposure, follow [security](/operations/security).
For a host/database loss, follow [recovery](/operations/recovery).

## Closure

Re-run the failed customer and staff journeys, verify queues are progressing,
reconcile external side effects and confirm alerts have recovered. Record the
cause, repair, customer impact and follow-up owner. Add any new failure scenario
to this handbook with a regression or monitoring check where appropriate.
