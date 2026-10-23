---
title: Backups and restore
---

# Backups and restore

**Audience:** owner and authorized operators.

**Prerequisites:** an agreed
acceptable data-loss window and recovery time, known backup locations and
permission for the specific recovery action. A routine documentation or code
task does not authorize restoring over production.

## What must be recoverable

| Data/system                    | Recovery requirement                                                             |
| ------------------------------ | -------------------------------------------------------------------------------- |
| PostgreSQL                     | Verified restore window and an isolated restore test                             |
| Uploaded product/support files | Backup/versioning or another verified recovery method, preserving private access |
| Redis job/workflow state       | Off-host recovery plan or a documented reconstruction/reconciliation procedure   |
| Configuration and credentials  | Controlled recovery from the secret store; never copies in the repo/docs         |
| Application images             | Identified current and previous compatible revisions                             |
| External payments and emails   | Independent provider evidence for reconciliation                                 |

Redis AOF on the same VPS helps process restart recovery. It is not an off-host
backup. A database backup does not contain all object-storage files or reverse
external payments and emails.

## Isolated restore drill

1. Restore into a new restricted target. Do not rewind the live database.
2. Disable outbound email, gateway operations and scheduled business workers
   before connecting the restored application. A different URL alone is not
   isolation.
3. Run the compatible application revision and inspect schema/migration state.
4. Validate representative orders, inventory, customer/support relationships,
   refund/email ledgers and required objects without exposing private data.
5. Record elapsed recovery time, the latest recovered data and any missing
   dependency. Compare these with the agreed recovery targets.
6. Clean up the drill according to the approved data-handling process.

## Real recovery and reconciliation

Stop or contain affected work and identify the last trustworthy state. Compare
gateway transactions/refunds and email provider receipts with the restored
ledgers before resuming jobs. External side effects after the backup still
exist even when their local record is absent.

Do not blindly replay restored queues or issue replacement payments/refunds.
Resolve uncertain records with an operator and preserve an audit trail. Resume
workers in a controlled sequence, then verify inventory, fulfillment and
customer communications.

## Retention and verification

The approved operational/security log-retention periods are separate from order,
support and backup retention. Configure actual expiry and verify provider copies,
exports and alert destinations follow the intended policy. See [production
operations](/reference/generated/production-operations) for the recorded policy
and remaining hosted decisions.

A restore plan is accepted only after a successful drill and a named recovery
owner. Record the evidence outside this handbook without including restored
customer data or credentials.
