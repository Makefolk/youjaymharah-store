# Security and reliability

The [October 22 remediation report](security-remediation-2026-10-22.md)
records the current authentication/refund changes, dependency findings and
validation. The September results below are historical.

## Changes in the September 2026 pass

- Redirect payment authorization and capture compare the verified amount, currency, and merchant reference to the stored session. Credo reads `transAmount`, `currencyCode`, and `businessRef`; refunded transactions cannot authorize a new order. Payment HTTP requests have a 15-second deadline and are not automatically retried by the client.
- Credo supports the raw-body `credo-signature` HMAC described in its security documentation. The explicitly configured legacy `X-Credo-Signature` token/business-code check remains available. An invalid HMAC never falls back to the legacy check. Credo's published guides disagree about the signing scheme: confirm the actual sandbox payload/header before launch. See [Credo security](https://docs.credocentral.com/docs/compliance-and-security) and its [testing guide](https://docs.credocentral.com/docs/developers/testing).
- Newsletter confirmation credentials are separate from unsubscribe credentials and expire after 24 hours. Confirmation replay cannot reverse an unsubscribe. New signups rotate credentials; existing unsubscribe URLs still work until a new signup rotates them. Old confirmation URLs must be replaced by signing up again.
- Signup, consent changes, and contact synchronization share a per-address lock. Repeat pending signups within 60 seconds do not send another email. Failed downstream delivery does not roll back consent.
- Resend callbacks verify the original body with the SDK's Svix signature and timestamp checks. Persistent receipts deduplicate events and recover unfinished processing every minute. Provider unsubscribes update consent; hard bounces, complaints and provider suppressions separately block newsletter delivery. Older opt-outs cannot reverse newer local consent. Provider opt-ins and suppression removals never automatically restore consent or clear a block. See [Resend webhook setup](resend-webhooks.md).
- Newsletter contact synchronization has a durable `sync_pending` flag and a five-minute reconciliation job, processing up to 100 records per run. Existing non-pending subscribers are queued by the migration. The admin page shows total subscriber counts and the number waiting to sync. Missing audience settings keep records queued; pending double opt-in records are not sent to Resend.
- Subscriber API pagination is bounded to 100 and token credentials are excluded from its response. Permission-query failures deny UI actions, including when old grants remain cached; API policies remain the authorization boundary.
- Newsletter Reply-To no longer replaces the verified sender. Resend requests have a 15-second deadline. Newsletter, initial order/cancellation/shipment/delivery, return, claim, exchange, product-alert, and cart-reminder emails carry stable provider delivery keys.
- Provider delivery identity is distinct from Medusa notification-attempt identity. Medusa 2.19's failed-key retry path generates a new notification ID without inserting that ID. Reminder/alert retry records therefore retain attempt-specific database keys, while Resend receives a stable key. [Resend deduplication expires after 24 hours](https://resend.com/docs/dashboard/emails/idempotency-keys); this is not an exactly-once guarantee.
- Password reset, verification, invite, refund and order-edit emails now use event-specific delivery keys and separate preparation from sending. A send retry reuses the prepared recipient, token, branding and data. Refund mail listens to `payment.refund.created` and queries its exact refund ID instead of guessing the newest refund on a payment. Order edits use their action IDs so later edits are not suppressed. See [Email retry behavior](email-reliability.md).
- Email acceptance receipts now persist beyond Resend's deduplication window. Pending rendered payloads are encrypted; confirmed acceptance clears the payload and blocks later duplicate sends. Uncertain outcomes older than 23 hours require review instead of automatic resend. This does not prove inbox delivery or retroactively deduplicate pre-rollout sends.
- Cart recovery expires seven days after the last reminder and checks the cart's email and customer ownership. Completed, stopped, recovered, or failed reminders cannot restore a cart. Stop-reminder links do not expire.
- Search increments are serialized through Medusa's locking module. Trending aggregation uses the newest result count, and persistence failures are no longer silently swallowed. Trending and suggestion routes are included in generated API documentation.
- Trending collection and publication now require an explicitly reviewed vocabulary managed in **Settings > Trending searches**. `SEARCH_TRENDING_TERMS` is only an initial fallback before the first admin save or seed. The initial seed provides common clothing/fabric phrases unless a saved or explicitly configured list exists; without seeding or configuration the list is empty. Unapproved text is filtered before entering the trending event/workflow pipeline, and legacy unapproved rows cannot appear in public results. A phrase needs five searches in seven days and a current published product match in the requesting sales channels. Counts still measure requests, not unique shoppers. See [Search privacy](search-privacy.md).
- The menu-card rename migration is conditional, with explicit approval to amend that historical migration. CI now runs unit tests and includes fresh PostgreSQL migration and repeat-run checks. The backend exposes a `test` script so root Turbo tests include it.

## Public request throttling

Limits use Medusa's shared cache and distributed locks in production, with hashed address keys retained for two minutes. Fixed one-minute windows allow bursts across a window boundary. Infrastructure failure returns 503 rather than bypassing the limit; exhausted quotas return 429 with `Retry-After`.

| Route group                                      | Requests per address per minute |
| ------------------------------------------------ | ------------------------------: |
| Newsletter signup                                |                               5 |
| Newsletter confirm/unsubscribe, combined         |                              30 |
| Product-alert signup                             |                              10 |
| Cart reminder links                              |                              30 |
| Search and search suggestions/trending, combined |                             120 |

These are application controls, not a substitute for perimeter protection. Configure an edge/WAF limit for authentication, password resets, uploads, guest wishlist writes, and broad traffic spikes. Verify trusted-proxy configuration against the actual hosting topology. Do not trust arbitrary client-supplied forwarding headers. If storefront requests originate from a server proxy, verify address attribution there before enabling traffic; otherwise shoppers share the proxy's quota. IPv6 address rotation and distributed clients still require edge controls.

## Deployment checklist

Production providers and the owner-approved 30-day operational / 90-day security
log policy are recorded in [Production operations](production-operations.md).
Hosted enforcement, alerts and backup settings are still pending; the policy
does not authorize purging commerce, consent or unfinished workflow records.

1. Use the declared Node 22.12+ (22.x) runtime. The isolated integration checks were run on Node 22.20 and PostgreSQL 15.
2. Take a database backup before deployment; apply `pnpm exec medusa db:migrate` from `apps/backend`. No catalog reseed is required for this pass. Do not roll back the additive newsletter migration while the new app is running.
3. Set `NODE_ENV=production`, a working `REDIS_URL`, and independent random JWT/cookie secrets of at least 32 characters. Startup rejects missing Redis or short secrets; build does not require these runtime secrets. Redis must use a non-evicting policy. Keep production/staging infrastructure isolated.
4. Use HTTPS, exact CORS origins, private database/Redis connectivity, and TLS certificate verification. Never place secret credentials in public environment variables. Redis-validation errors no longer print any part of its URL.
5. Restart application and worker processes after migration. Verify that the five-minute newsletter job runs and queued counts fall. Check the audience and Resend API permissions if records stay queued.
6. Complete sandbox payment tests: correct payment, underpayment, currency/reference mismatch, duplicate and malformed webhooks, refunds, and delayed payment verification. Unit tests mock the gateways; they do not establish live-provider compatibility.
7. Configure the [Resend webhook endpoint and signing secret](resend-webhooks.md), then test with a test audience before sending broadcasts. Outbound sync checks the existing contact and never deliberately resets a Resend unsubscribe; such contacts remain queued for review. Resubscribing them requires verified renewed consent and an explicit update in Resend. Local delivery blocks also require developer review; signing up again does not clear them.
8. Verify the fresh-database migration and security HTTP/database integration CI jobs on the deployment commit. These checks can also run locally against a disposable cluster using the command below; a local pass does not verify GitHub Actions. Suites include webhook persistence, Marketing/Support/role-less admin permissions, payment verification persistence, repeated authorization, partial-refund events, failed refunds and competing refunds. Physical checkout coverage includes flat-rate shipping, tax-inclusive/exclusive pricing, missing shipping, inventory reservations, replay, underpayment rollback/retry, stock changes and two carts competing for the last unit. Gateway and email HTTP are mocked. Browser checkout and Redis-backed multi-worker concurrency still need verification.
9. Alert on payment verification failures, prolonged newsletter sync backlog, failed workflows/jobs, 429/503 rates, and mail failures. Exercise a backup restoration before launch.

## Local isolated verification

Verified locally on September 23, 2026: fresh migrations and their repeat run,
all 30 HTTP/database integration cases (five suites), and 128 unit tests.
GitHub Actions still needs verification on the deployment commit.

With Node 22 and PostgreSQL 15 binaries installed (no running database service required):

```bash
cd apps/backend
pnpm run test:isolated
# Focused rerun; the selected suite still migrates its own fresh database:
pnpm run test:isolated --tests-only integration-tests/http/payment-safety.spec.ts
pnpm run test:isolated --tests-only integration-tests/http/physical-checkout.spec.ts
```

The script creates a password-protected temporary cluster on a random loopback
port, overrides application/provider credentials with test values, runs fresh
migrations twice, and executes the HTTP integration suites. It stops and removes
that cluster on success or test failure. It never uses the application's database
or runs catalog seeds. PostgreSQL binaries are detected in the Apple Silicon
Homebrew and Debian PostgreSQL 15 locations; elsewhere, set `POSTGRES_BIN` to the
directory containing `initdb`, `pg_ctl` and `createdb`. Run as a non-root user.

Medusa 2.19's test utility enables TLS unless `DB_HOST` is literally `localhost`;
the script accounts for this. Do not point the raw integration command at an
application database: the test utility creates, restores and drops its test
databases. `MEDUSA_TEST_DB_ISOLATED=1` is an acknowledgement, not isolation by
itself. CI uses its own disposable PostgreSQL service.

These tests use local event bus/locking implementations. They do not verify
Redis restart recovery, distributed locking, live gateway compatibility, or
delivery through Resend. Database-template restores can log closed pooled
connections; the Jest assertions and exit code determine the result.

The physical-checkout fixture creates a real sales channel, region, tax rate,
shipping profile/option, warehouse and inventory level. Carts and shipping
methods go through Medusa's standard workflows, not hard-coded cart totals.
Assertions compare the cart, payment collection, gateway minor-unit amount,
order and capture totals. Replay must retain one reservation/capture;
underpayment must release the reservation and permit a correctly paid retry;
competing carts must leave one live order and no payment on the losing cart.
The fixture is deliberately a single warehouse, one variant and flat-rate
shipping; it does not cover discounts, multi-warehouse allocation or fulfillment.

## Backend/admin pending

- Verify the CI run on the deployment commit and extend the role/route permission matrix beyond Marketing, Support and role-less users.
- Extend checkout coverage to discounts, multi-warehouse allocation and fulfillment/cancellation stock changes; core shipping/tax/reservation cases are covered locally.
- Exercise Redis-backed retries and locking across workers/restarts, real payment sandbox callbacks, and Resend callbacks against a test audience.
- Durable email acceptance tracking and encrypted rendered snapshots are implemented. Deploy the additive migration and configure `EMAIL_DELIVERY_ENCRYPTION_KEY` on backend/workers. Operator resolution UI and a receipt-lifecycle policy remain follow-ups; see [Email retry behavior](email-reliability.md).
- Configure alerting, edge/proxy limits, backups and restore drills from the deployment checklist. Apply the approved log-retention policy through the hosted providers; see [Production operations](production-operations.md) for decisions and remaining setup gates.
- Populate the reviewed trending vocabulary in **Settings > Trending searches** and enforce the approved log-retention policy. The editor is implemented; repeated requests can still influence ranking.
- Resolve the remaining dependency findings below through compatible upstream upgrades or tested overrides.

### Remaining dependency findings

The production audit after compatible overrides reports **0 critical, 0 high, 2 moderate** findings. Overrides are in `pnpm-workspace.yaml`; the lockfile was regenerated by pnpm. Remove overrides when the upstream packages adopt safe versions.

| Package     | Remaining version            | Follow-up                                                                                                                                                                                                             |
| ----------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uuid`      | 9.0.1, via BullMQ            | Upgrade the owning dependency or test a targeted major-version override. [Advisory](https://github.com/advisories/GHSA-w5hq-g745-h8pq).                                                                               |
| `csv-parse` | 5.6.0, via Medusa core flows | Upgrade through Medusa or test the 7.x parser against product-import fixtures. Restrict CSV import permissions and use trusted import files meanwhile. [Advisory](https://github.com/advisories/GHSA-8cw4-87c7-c6xx). |

Major-version overrides were not forced in this pass. Re-run `pnpm audit --prod` routinely; this result is a point-in-time check, not a security certification.

## Storefront pending (separate workstream)

- Browser-level checkout verification, including gateway return/cancel, duplicate completion, shipping/tax presentation and stock changes during checkout.
- Verify newsletter opt-in and pending-confirmation/unsubscribe states against the hardened backend contracts.
- Complete and verify customer-facing order tracking and self-service returns as described in the [storefront build guide](storefront-build-order.md). Returns also require configured backend shipping options and an agreed returns policy.
- Validate shopper-address attribution if API calls pass through a storefront server proxy, so rate limits do not group all customers under one address.

This backend verification pass does not certify storefront UI completion or accessibility; assess those separately against the current storefront.
