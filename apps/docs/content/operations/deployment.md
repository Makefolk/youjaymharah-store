---
title: Deploy and roll back
---

# Deploy and roll back

**Audience:** release operators.

**Prerequisites:** authorized environment,
successful release checks, exact image tags, backup/recovery evidence and a
rollback owner. See the imported [deployment runbook](/reference/generated/deployment)
for the actual variables, credentials and current workflow commands.

## Before deployment

1. Confirm the intended branch/tag and GitHub Environment. Check that the host's
   environment agrees; do not reuse a production secret set for staging.
2. Review migrations and persisted workflow changes for compatibility with
   currently running server and worker processes.
3. Run backend checks, API-codegen freshness and the storefront production build
   against a suitable controlled API. Do not use a local dev server as proof
   that the production image builds.
4. Reconcile old payment/refund ambiguity and follow the email runbook's
   pause/drain procedure for incompatible persisted workflow changes.
5. Record current image tags, known outstanding work and the backup/restore
   point. Confirm alerts will reach the responsible person.

## Rollout behavior

The repository's workflow is manually dispatched. Infrastructure scripts apply
migrations and restart containers, then check routes. Application rollback does
not revert schema migrations or external side effects.

The existing deployment sequence can deploy the backend before building the
storefront against it. Until this sequence is changed and verified, use a
staging dress rehearsal and preserve compatibility with the previous storefront.
If the later build fails, inspect the running version of every component before
declaring the release rolled back.

Migrations run while older processes may still be active. Use additive changes,
then remove obsolete behavior in a later release after old workers/data no
longer require it. A deployment that changes durable workflow graphs needs an
explicit drain/compatibility plan.

## Verify after rollout

Check backend readiness, storefront readiness and actual rendered pages through
the public proxy. Confirm the expected image revision, catalog, customer
sign-in, delivery options, gateway configuration, worker activity and email
processing. Inspect error rates and backlogs during the observation period.

Do not make an unplanned real payment as a health probe. Use the approved
acceptance procedure and its isolated or controlled-live data.

## Roll back

Restore the previous compatible image tags using the documented deployment
procedure. Recheck schema compatibility and migration history before doing so.
Never delete migrations or rewind a production database to repair an image
failure. If a schema/data restore is necessary, follow [recovery](/operations/recovery)
and reconcile gateway/email side effects before resuming workers.

The release is complete when the intended versions are running, the acceptance
checks pass, and any remaining manual work has an owner and deadline.
