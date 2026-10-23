# Security and dependability remediation — October 22, 2026

These changes address confirmed problems in the local checkout. They have not
been deployed. Production data, real payments and outbound email were not used
for validation. Existing concurrent dependency updates were preserved.

## Changes

| Area                  | Implemented protection                                                                                                                                                                                                                                                                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin credentials     | Notification list/detail APIs expose feed notifications only, with a field allowlist. Email reset, invitation and verification payloads cannot be fetched through those APIs. Workflow execution APIs require a current Super Admin role, including when older role grants remain in the database. |
| Google sign-in        | A short-lived HttpOnly state cookie binds the callback to the browser that started sign-in. Missing, mismatched and consumed state are rejected before token exchange or cart transfer.                                                                                                            |
| Account linking       | Google cannot automatically attach to an existing password identity whose email is unverified. Google verification only applies to the account's current matching email. Workflow failures cannot fall through to a successful social-login response.                                              |
| Authentication abuse  | Shared application limits cover native customer/admin login, registration, password reset/update and guest wishlist writes. Registration and password updates enforce 8–128 characters. Storefront auth calls forward the client address supplied by the configured trusted proxy.                 |
| Request resources     | Streamed bodies are bounded even without Content-Length. Auth JSON is limited to 16 KiB; ordinary proxy mutations to 64 KiB; support photo submissions to 15 MiB. Body reads have a 10-second deadline and backend calls a 30-second deadline, with cancellation and Retry-After propagation.      |
| Refunds               | Paystack recording verifies a completed refund against the original gateway transaction, amount and currency. A durable ledger rejects reused gateway references; recording is serialized per payment. Credo recording also uses the ledger.                                                       |
| Dependencies          | Available dependency fixes were installed through pnpm. Storefront shadcn tooling is now a development dependency. Dependabot checks npm packages and GitHub Actions weekly. Two unpatched advisories remain below.                                                                                |
| Checks and monitoring | HTTP integration suites run in bounded Jest batches to avoid accumulated application-loader memory. Uptime checks probe API and storefront separately and fail on missing configuration.                                                                                                           |

The notification bell remains available. Workflow execution inspection is now
restricted to Super Admins; Store Managers may need owner assistance with
workflow/import diagnostics. This restriction protects credentials in persisted
workflow context, as well as the email notification records themselves.

## Refund operation and rollout

Paystack refunds now start in the Paystack dashboard. After Paystack reports
`processed`, staff enter its numeric refund ID and the exact amount in the
order's **Gateway refunds** widget. The backend fetches the refund before
recording it in Medusa and queuing the customer notification. Pending, failed,
processing and mismatched refunds are refused. The ordinary Medusa refund
button no longer initiates Paystack transfers. Credo still requires staff to
refund in its dashboard and record the reference; Credo completion cannot be
independently verified through its current integration.

This deliberately removes automatic Paystack refund submission and the unsafe
retry after an ambiguous response. It does not implement automatic refund
webhook reconciliation. Paystack documents its refund status and fetch APIs in
the [refund guide](https://paystack.com/docs/payments/refunds/) and
[API reference](https://paystack.com/docs/api/refund/).

Before deploying:

1. Back up the database and apply the additive `refundLedger` migration with
   `pnpm exec medusa db:migrate` from `apps/backend`, through the normal deployment
   procedure. No application database was migrated during this local work.
2. Reconcile previously pending or uncertain gateway refunds. A Paystack payment
   with earlier untracked local refunds is refused until reconciled, to avoid
   counting the same gateway refund again. Historical Credo references in refund
   notes are also checked for repeats.
3. If a ledger claim survives a failed local write, compare the gateway receipt,
   ledger and Medusa refund before repairing the local record. Do not issue a new
   gateway refund or delete the claim simply to retry. This state needs operator
   reconciliation; no automatic repair UI is included.
4. Configure repository variables `HEALTH_URL` as the API HTTPS `/health` URL and
   `STOREFRONT_HEALTH_URL` as the storefront HTTPS `/api/health` URL. Both must
   return 200. These variables have not been set on the hosted repository.
5. Verify the actual edge/proxy path preserves Caddy's replacement of
   X-Forwarded-For and keeps backend/storefront application ports private.

## Validation

- Backend unit tests: **27 suites, 240 tests passed**.
- Storefront tests: **25 files, 169 tests passed**; ESLint and generated-route
  TypeScript checks passed.
- Backend and admin production build: passed, including framework lint and type
  generation. One existing Medusa lint warning remains in `link-guest-orders.ts`.
- Fresh PostgreSQL 15 migrations and a repeat migration run passed against a
  disposable cluster. No production or application database was used.
- HTTP/database integration: **20 suites, 77 tests passed**, using bounded
  batches and focused reruns after updating the refund fixtures and account
  matching guard.
- API contracts were regenerated and their freshness check passed. Changed files
  were formatted with the repository's Prettier configuration.
- Uptime script checks passed for missing configuration, healthy endpoints and a
  failing storefront, with mocked HTTP responses.

Gateway and email HTTP calls are mocked. The HTTP suites use local event bus and
locking implementations; they do not establish Redis restart recovery or
multi-worker behavior. Storefront production prerendering needs a running
backend and was not performed. Live Google and gateway sandbox flows still need
deployment validation.

## Remaining work and limits

- The final production dependency audit reports **0 critical, 1 high and 1
  moderate** advisory entries. The remaining packages are
  [braces](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) and
  [sprintf-js](https://github.com/advisories/GHSA-hp3w-g68c-fv3c). Their reviewed
  advisories list no patched release, and the registry does not publish the
  versions suggested by its audit response. No public path accepting attacker
  supplied glob patterns or format strings was established in this review.
  These findings are not suppressed and should be revisited when fixes ship.
- **Done October 23:** finishing a password reset, changing a password, or
  "Sign out of all devices" now ends every earlier customer and admin sign-in
  (tokens, token refresh and admin sessions), through a per-account cutoff in
  the `sessionRevocation` module. Admin MFA enforcement remains separate work.
- **Done October 23:** an order ID alone no longer opens an order. Order pages
  and their return options and help form need the signed-in customer or a
  signed key from an order link, valid 60 days; every order email carries a
  fresh one, and "Track your order" emails a link instead of opening the
  order.
- The payment attention panel is still a bounded recent-session view. Durable
  reconciliation with pagination, next-check times and escalation is needed so
  older paid attempts cannot remain behind newer abandoned attempts.
- Worker heartbeats, queue-age alerts, Redis/disk alerts, off-host recovery and
  restore drills remain unverified. The GitHub uptime workflow is a backstop,
  not continuous monitoring. See [production operations](production-operations.md).
- Browser journeys and Redis-backed restart/concurrency tests remain to be
  exercised. GitHub Actions and deployment checks must run on the release
  revision; local passes do not establish a successful deployment.
