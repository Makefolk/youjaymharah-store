# Deploy Notes — Backend / Admin

What the backend needs from its environment, and the gotchas that are easy to
hit exactly once. The production setup (VPS, Docker Compose, Caddy, Neon, the
Deploy workflow) is in [docs/deployment.md](../../docs/deployment.md).

## Environment variables

Copy `.env.template` and fill in every key. Notes on the non-obvious ones:

| Variable                                  | Notes                                                                                                                                                                                                                                                                                                                                                                                                           |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                            | PostgreSQL 15+. Neon free tier works; make sure the URL is URL-encoded if the password contains special characters.                                                                                                                                                                                                                                                                                             |
| `REDIS_URL`                               | Required in production, where `infra/compose.yaml` points it at the Redis container. Backs the event bus, workflow engine, cache, locks and admin sessions: events survive deploys, failed email steps retry durably, and admins stay signed in across deploys. Any Redis used must have eviction off (`noeviction`), or queued jobs such as order emails are silently dropped. Leave unset only for local dev. |
| `STORE_CORS` / `ADMIN_CORS` / `AUTH_CORS` | Comma-separated origins. Include the deployed storefront and admin origins.                                                                                                                                                                                                                                                                                                                                     |
| `STOREFRONT_URL` / `ADMIN_URL`            | Used to build links inside emails (order confirmations, invites, newsletter confirm/unsubscribe). Wrong values here produce dead links in live emails.                                                                                                                                                                                                                                                          |
| `STOREFRONT_REVALIDATE_SECRET`            | Leave unset for now. Saving Brand or Sharing & search would call `POST <STOREFRONT_URL>/api/revalidate`, but the storefront has no such route yet, so setting it only logs failed calls. Admin changes reach the site within 5 minutes regardless (the storefront's cache).                                                                                                                                     |
| `RESEND_API_KEY` / `RESEND_FROM_EMAIL`    | Transactional email. Without these, notification sends fail (they retry, but nothing arrives).                                                                                                                                                                                                                                                                                                                  |
| `EMAIL_DELIVERY_ENCRYPTION_KEY`           | Exactly 64 hex characters (`openssl rand -hex 32`). Encrypts pending email snapshots. Production refuses to start without it; development starts with a warning, and every email then fails before reaching Resend.                                                                                                                                                                                             |

## First deploy checklist

1. `pnpm install` at the repo root (pnpm; lockfile is authoritative).
2. `pnpm run build --filter=@youjaymharah/backend` (or `medusa build` in the app).
3. `pnpm exec medusa db:migrate` in `apps/backend`. This applies module
   migrations AND runs the seed scripts. Medusa 2.20 still exits 0 when a seed
   fails, so run `pnpm exec medusa db:migrate:scripts` afterwards to see a seed
   error (production deploys run it as its own step for this reason). The
   seeds provision:
   - RBAC roles (`seed-rbac-roles.ts`)
   - Sales channel, publishable API key (token is printed to the deploy log --
     set it as the storefront's `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`),
     store record (name from `STORE_NAME`, currencies NGN default + USD),
     Nigeria region wired to `pp_credo_credo` / `pp_paystack_paystack`, tax
     region, and the
     "Lagos Warehouse" stock location (`initial-data-seed.ts`)
   - The first admin user from `ADMIN_EMAIL` / `ADMIN_PASSWORD`, already
     attached to the Super Admin role -- log straight in, no bootstrap needed
4. Verify: `GET /health` returns 200 with `"database": "ok"` (and
   `"redis": "ok"` when `REDIS_URL` is set; it answers 503 if either is
   unreachable), admin loads (at `/app` locally, at
   `admin.<domain>` in production), log in with
   `ADMIN_EMAIL`, and the boot log shows
   `Connection to Redis in module 'event-bus-redis' established` when
   `REDIS_URL` is set.

Not seeded on purpose: product categories, products, shipping options and
service zones (configure in the dashboard to match the real catalog and
courier pricing), and any publishable key beyond the first.

## Known gotchas

- **RBAC feature flag.** `featureFlags.rbac` must stay `true` in
  `medusa-config.ts`. The dashboard hides the role picker on invites and the
  role management pages without it, and enabling it after users exist 403s
  every role-less admin (fix: assign each existing admin a role, then have
  them sign in again).
- **Payment webhooks.** Credo and Paystack call
  `POST /hooks/payment/credo_credo` and `/hooks/payment/paystack_paystack`
  (Medusa's `<identifier>_<id>`). During a deploy's restart, Caddy holds
  requests for up to 30 seconds, and both providers retry a webhook that
  still fails, so check for a deploy first when diagnosing a stuck payment.
- **Emails during deploys.** The Redis workflow engine keeps in-flight email
  steps across restarts and retries them on schedule. Only local dev without
  `REDIS_URL` loses what was in flight when the process stops.
- **Guest wishlist cleanup.** A scheduled job
  (`src/jobs/delete-stale-guest-wishlists.ts`) deletes guest wishlists with no
  saves for 90 days, daily at 03:30 server time, in `medusa-worker`. The 90
  days must match the storefront's
  wishlist cookie (`WISHLIST_MAX_AGE_SECONDS` in
  `apps/storefront/lib/medusa/session.ts`) -- change both together.
- **"Notify me" emails.** A scheduled job
  (`src/jobs/send-product-alerts.ts`) checks waiting alerts against stock every
  10 minutes, in `medusa-worker`, and emails the ones whose item can be
  bought. The "Shop now" link is built from
  `STOREFRONT_URL` plus `/products/<handle>`. A send that errors is retried on
  the next run; after 5 failures (about 50 minutes, e.g. an address Resend
  rejects) the alert is marked `failed` and left alone. A Resend outage longer
  than that fails the alerts that were due during it.
- **New permissions on an existing environment.** Migration scripts run only
  once, so existing roles don't pick up policies added later (such as
  `size_guide`). After deploying a feature that adds policies, run
  `pnpm exec medusa exec ./src/scripts/seed-rbac-roles.ts` in `apps/backend`;
  it only adds missing grants. Until then only Super Admins can open
  **Products › Size guides**.
- **Resend audience picker.** Settings -> Newsletter needs `RESEND_API_KEY`;
  if it is missing the picker shows an error but settings can still be saved.
