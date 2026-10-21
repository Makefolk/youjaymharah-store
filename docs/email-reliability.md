# Email retry behavior

Password resets, email verification, team invites, refunds and order edits use
two workflow steps: prepare the notification once, then send it. The workflow
engine retains the preparation output when retrying a failed send. The delivery
step retries up to five times, 15 seconds apart. Production requires the Redis
workflow engine; local in-memory retries do not survive a restart.

## Delivery identities

| Email              | Identity used before hashing                |
| ------------------ | ------------------------------------------- |
| Password reset     | Actor type, recipient, reset token          |
| Email verification | Recipient, verification token               |
| Team invite        | Invite ID, recipient, current invite token  |
| Refund             | Exact refund ID                             |
| Order update       | Order ID and sorted, unique edit action IDs |

Keys are SHA-256 hashes with an email prefix. Tokens and email addresses are
not sent as plaintext in the idempotency header. A new token, partial refund or
order edit gets a new key. Separate recipient/actor identities cannot collide
through ambiguous string concatenation.

The notification data itself still contains recipient addresses and, for
authentication emails, links with credentials. Restrict access to notification
and workflow records and include them in retention and erasure policies.

## Refunds and edits

The refund subscriber listens to Medusa's `payment.refund.created` module event,
not `payment.refunded`. The latter only names the payment and cannot identify
which of several partial refunds caused the event. The preparation step queries
the refund by ID and includes its amount and customer-facing reason label,
never the internal refund note. Provider-rejected refunds must not leave a
refund or generate customer mail. Nested cleanup can flush a created event
after deleting the failed refund; preparation rejects that missing record.
The isolated payment suite covers this path against the installed framework.

Order-edit events supply action IDs. Missing IDs fail preparation rather than
using an order-wide key that could suppress later updates. The email is a
summary of the order when preparation runs, not a historical reconstruction of
the edit. A delayed initial event may therefore summarize a later order state;
delivery retries of that execution retain its prepared snapshot.

Verification emails display a fixed UTC expiry time instead of recalculating
remaining minutes on each attempt. A resent invitation with a renewed token
has a new delivery identity. An older already-prepared email can still arrive
late with its original link; preparation does not extend or renew credentials.

## Limits and rollout

Resend keeps idempotency keys for [24 hours](https://resend.com/docs/dashboard/emails/idempotency-keys).
The `email_delivery` module now retains acceptance receipts beyond that window.
All Resend notification calls must supply `emailIdempotency(...)`; a missing
identity fails closed rather than sending an untracked email. The provider
shares a per-delivery lock and persists the encrypted rendered request before
contacting Resend. Retries reuse the original recipient, subject, sender,
Reply-To, rendered HTML/text and attachment contents even across template or
branding changes. Verify SDK serialization when upgrading Resend.

After provider acceptance, the ledger retains its hashed delivery identity,
provider receipt, timestamps and attempt count; the encrypted payload is cleared.
Later replays return that receipt without another provider call. "Accepted"
means Resend accepted the request, not that it reached the shopper's inbox.
Bounce/complaint handling remains separate.

There is still no exactly-once transaction spanning PostgreSQL and Resend.
If acceptance or the receipt write is uncertain, retries use the same snapshot
and provider key for at most **23 hours from the first attempt**. Beyond that,
a retry marks the row `needs_review` and refuses to resend. The one-hour margin
avoids relying on a key near Resend's expiry. A stale `attempted` record needs
the same review even when no further retry arrives to change its status.
Existing workflow retry schedules are unchanged; the ledger is not a new
automatic recovery queue. No automatic deletion or force-resend is added.

Do not assign the stable provider key to Medusa's notification database key:
Medusa 2.19's failed-key path can reference an unpersisted notification ID.
These workflows create separate notification attempts while keeping the Resend
key stable.

Run `pnpm exec medusa db:migrate --skip-scripts` before deploying this change;
the new module needs its additive migration. No seed is needed. Set
`EMAIL_DELIVERY_ENCRYPTION_KEY` to **32 cryptographically random bytes encoded
as 64 hex characters**, identical on backend and workers. Generate and store it
through your secret manager; never put it in source control or logs. Production
startup rejects a missing/invalid key: `medusa-config.ts` checks it, so the
migration step of a deploy fails before the running version is replaced. In
development the backend warns at startup and email sends fail closed until the
key is configured. Snapshot encryption uses AES-256-GCM with a fresh
IV and binds the ciphertext to its delivery ID.

Keep this key available for pending snapshots and relevant backups. Do not
rotate it while snapshots still need it without an explicit re-encryption/key
rotation plan. Missing or wrong keys never trigger recreation of the message.
Framework notification/workflow records still contain their original data;
snapshot encryption does not encrypt those separate records.

Pause/drain workers for rollout, migrate, configure the key, then restart the
backend and workers. Old sends have no ledger receipt: do not replay historical
notifications assuming they are covered by this new protection. Review uncertain
pre-rollout sends separately against provider evidence.

The five workflow graphs
have changed: finish or explicitly review old pending executions before
deploying into an environment that already has queued emails. Do not blindly
replay an old refund workflow input containing only `payment_id`; the new
input requires `refund_id`.

### Reviewing uncertain deliveries

Open **Email review** in the admin sidebar (Support and Store Managers). It
lists unresolved sends, oldest first, with the email type, recipient and order
where they can be matched: `Blocked` ones stopped for review, and `No answer`
ones attempted over 23 hours ago. Find each in Resend's email log by recipient
and time, then record the verdict:

- **It was sent:** paste the email's ID from Resend as evidence. The receipt
  is reconciled to accepted and the stored copy is dropped.
- **It wasn't sent:** the verdict is recorded, but the delivery stays blocked,
  so the stored email can never go out late. Send a replacement deliberately:
  Resend on the order page for confirmations and shipping emails; a fresh
  request for password resets, verifications and return links.
- **Can't tell:** leave it in the list.

Each verdict records who made it and when. Never delete a receipt, clear
`first_attempt_at`, or generate a new key to bypass a block.

`pnpm exec medusa exec ./src/scripts/inspect-email-deliveries.ts` from
`apps/backend` still prints counts per status for incident logs. It is
read-only and does not print message content or recipient addresses. The
ledger ID is `emdel_` plus SHA-256 of the notification's provider idempotency
key; use that key to correlate provider evidence. Never paste credentials,
message bodies or full customer details into an incident log. A lifecycle
policy for old receipts remains a follow-up.

Unit tests cover identities, skipped notifications, encryption, concurrent sends,
saved-payload retries, receipt-write failures and blocking stale uncertainty.
Focused PostgreSQL checks exercise notification-provider injection, persistence,
concurrent deduplication and stale outcomes with email HTTP mocked.
The PostgreSQL integration suites passed locally against an isolated database;
CI still needs verification on the deployment commit. They do not send live
gateway requests or prove live-provider compatibility.

The approved [log-retention policy](production-operations.md) does not purge
notification/workflow data or email delivery/deduplication records. Those need
a separate lifecycle policy that preserves recovery and replay protection.
