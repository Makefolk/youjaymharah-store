# Production deployment

How this store runs in production and how to operate it: one VPS running
Docker Compose, with PostgreSQL on Neon and files in object storage.
Operational policy (log retention, backups, restore drills) lives in
[production-operations.md](./production-operations.md).

Nothing here deploys on its own. Production goes live when the steps in
[First deployment](#first-deployment) are followed and the Deploy workflow is
run by hand.

## Architecture

```text
Internet ─ Cloudflare (optional) ─ VPS :80/:443 ─ Caddy
                                                    ├── <domain>         → storefront   (Next.js, :8000)
                                                    ├── www.<domain>     → 301 to <domain>
                                                    ├── api.<domain>     → medusa-server (:9000)
                                                    └── admin.<domain>   → admin        (static dashboard, :8080)

medusa-server ─┬─ Neon PostgreSQL (direct endpoint, TLS)
medusa-worker ─┤
               └─ redis (container, internal network only)
storefront ──── medusa-server over the Docker network (never through Caddy)
```

| Service         | Image                            | Role                                                                       |
| --------------- | -------------------------------- | -------------------------------------------------------------------------- |
| `caddy`         | `caddy:2.10-alpine`              | TLS (Let's Encrypt), routing by hostname, the only published ports         |
| `medusa-server` | `backend:<sha>`                  | Store and Admin APIs, auth, payment and email webhooks. No background work |
| `medusa-worker` | `backend:<sha>` (same image)     | Subscribers, scheduled jobs, workflow steps, search indexing. No routes    |
| `admin`         | `admin:<sha>-<environment>`      | The dashboard as static files, built for `https://api.<domain>`            |
| `storefront`    | `storefront:<sha>-<environment>` | Next.js standalone server                                                  |
| `redis`         | `redis:7.4-alpine`               | Event bus, workflow engine, cache, locks, admin sessions                   |

Files: [`infra/compose.yaml`](../infra/compose.yaml),
[`infra/caddy/Caddyfile`](../infra/caddy/Caddyfile),
[`infra/deploy.sh`](../infra/deploy.sh),
[`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml).

### Why it is built this way

- **Admin is static files on its own hostname**, built with
  `medusa build --admin-only` at base path `/` and `https://api.<domain>`
  compiled in. Serving Medusa's built-in `/app` at `admin.<domain>` would need
  path rewriting that breaks asset URLs and client-side routes. The dashboard
  calls `api.<domain>` cross-origin. That is a different origin but the same
  site, so Medusa's `SameSite=Lax` session cookie still flows. `ADMIN_CORS` and
  `AUTH_CORS` allow exactly `https://admin.<domain>`.
- **Server and worker are split.** Search uses the PostgreSQL provider, so the
  index lives in Neon: the worker fills and updates it, the server only
  queries it. Background work (emails, cart reminders, stock alerts, index
  updates) cannot slow down API requests, and each process can be restarted
  on its own.
- **One Medusa server, no blue/green.** A deploy restarts it. Caddy holds
  requests that cannot connect for up to 30 s, so a restart normally shows up
  as a slow response rather than an error. Genuine zero-downtime deployment
  (two servers behind a health-checked switch) is possible with this
  architecture and deliberately deferred: not worth it at this traffic.
- **Neon's direct endpoint, not the pooler.** Medusa is a long-running process
  holding a small pool (knex/pg, 2 to 10 connections per process). The two
  processes plus a migration run stay far below Neon's direct connection
  limit. PgBouncer's transaction mode would add a hop and buy nothing, so one
  `DATABASE_URL` serves runtime and migrations alike.
- **Redis runs next to Medusa** with `noeviction`, append-only persistence and
  no published port, on a Docker network only the two Medusa services join.
  It holds job and session state, not business data.
- **Images are built in GitHub Actions, never on the VPS.** The backend image
  has no domain in it. The admin and storefront images compile in their
  deployment's URLs and publishable key, so they are tagged per environment.

## Configuration: where each value lives

| Where                                           | What                                                                                                                                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| GitHub Environment **secrets**                  | `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_KNOWN_HOSTS`; optional `SENTRY_AUTH_TOKEN` (storefront source maps)                                                                                  |
| GitHub Environment **variables** (build-time)   | `DOMAIN`, `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`, `IMAGE_REMOTE_URLS`; optional `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT`, `DEPLOY_PATH` (default `/opt/store`), `DEPLOY_SSH_PORT` (default 22) |
| VPS `/opt/store/.env` (not secret)              | `DOMAIN`, `ACME_EMAIL`, `ENVIRONMENT`, `IMAGE_PREFIX`, and the image tags `deploy.sh` maintains. Template: [`infra/.env.template`](../infra/.env.template)                                                   |
| VPS `/opt/store/backend.env` (secret, mode 600) | Everything Medusa reads at runtime: database, CORS, secrets, payments, email, storage. Template: [`infra/backend.env.template`](../infra/backend.env.template)                                               |
| `infra/compose.yaml`                            | `REDIS_URL`, `MEDUSA_WORKER_MODE`, `NODE_OPTIONS`, `SENTRY_RELEASE`, the storefront's runtime `MEDUSA_BACKEND_URL`                                                                                           |

The public URLs resolve as:

| Purpose     | Value                                                                        | Set in                                                     |
| ----------- | ---------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Storefront  | `https://<domain>`                                                           | `STOREFRONT_URL` (backend), `NEXT_PUBLIC_BASE_URL` (build) |
| Backend/API | `https://api.<domain>`                                                       | admin and storefront image builds (`MEDUSA_BACKEND_URL`)   |
| Admin       | `https://admin.<domain>`                                                     | `ADMIN_URL` (backend), invite and password-reset links     |
| CORS        | `STORE_CORS=https://<domain>`, `ADMIN_CORS=AUTH_CORS=https://admin.<domain>` | `backend.env`                                              |

The workflow derives every URL from `DOMAIN`, so a new client deployment is a
new GitHub Environment plus a VPS: no code changes.

## One-time setup

### VPS (OVH, 4 vCPU / 8 GB)

Expected memory: roughly 0.5 to 1 GB for each Medusa process and 0.3 GB for
the storefront, with Redis and Caddy well under 0.2 GB together. That leaves
most of the 8 GB free. No container memory limits are set: on a single
dedicated host a hard limit adds an OOM failure mode without protecting
anything. Each Medusa process caps its V8 heap at 1.5 GB instead
(`NODE_OPTIONS` in `compose.yaml`).

1. Ubuntu 24.04 LTS (or Debian 12). Install Docker Engine and the Compose
   plugin from Docker's apt repository (not the distribution's `docker.io`).
   The deploy script also needs `curl` and `flock` (util-linux), both
   present on a stock install.
2. A deploy user, used only by GitHub Actions:

   ```sh
   sudo adduser --disabled-password deploy
   sudo usermod -aG docker deploy
   sudo install -d -o deploy -g deploy -m 750 /opt/store
   ```

   Membership of `docker` is root-equivalent: keep this key for deployments
   only, and give people their own accounts.

3. SSH: key authentication only (`PasswordAuthentication no`,
   `PermitRootLogin no`). Generate a dedicated key pair for deployments and
   add the public half to `~deploy/.ssh/authorized_keys`.
4. Firewall: allow 22, 80 and 443 (plus 443/udp for HTTP/3), deny the rest.
   `ufw` works for SSH, but Docker publishes ports through its own iptables
   chain and bypasses `ufw`. Only Caddy publishes ports here, so nothing else
   is exposed either way. To accept web traffic only from Cloudflare, do it in
   OVH's network firewall (control panel), not in `ufw`.
5. Put the runtime configuration in place:

   ```sh
   cd /opt/store
   # copy infra/.env.template and infra/backend.env.template from the repo
   cp .env.template .env && cp backend.env.template backend.env
   chmod 600 backend.env
   # edit both
   ```

   (The first workflow run also copies the templates, `compose.yaml`,
   `deploy.sh` and `caddy/` into `/opt/store`; it never touches `.env` or
   `backend.env`.)

### DNS and Cloudflare

Create A (and AAAA, if the VPS has IPv6) records for `<domain>`,
`www.<domain>`, `api.<domain>` and `admin.<domain>`, all pointing at the VPS.
Caddy requests one certificate per hostname through HTTP-01 on port 80.

With Cloudflare in front:

- **SSL/TLS mode: Full (strict).** Caddy has real certificates.
- **Always Use HTTPS: off.** Caddy already redirects HTTP to HTTPS, and
  leaving this off lets Let's Encrypt reach port 80 for issuance and renewal
  through the proxy.
- **First deployment:** start the records as DNS-only (grey cloud). Switch
  them to proxied once the three hostnames serve valid certificates.
- **Caching:** the defaults are right, since Cloudflare caches only static
  file extensions. Do not add Cache Everything or APO rules for `api.` or
  `admin.`: their responses are per-user. The admin's JS bundles have hashed
  names and `immutable` headers, and the storefront's `/_next/static` files
  are fingerprinted too.
- **Leave off:** Rocket Loader (breaks Next.js hydration), and Bot Fight Mode
  or challenges on `api.` (they block payment webhooks and the deploy
  workflow, which builds the storefront from GitHub's runners against
  `api.<domain>`).
- WebSockets can stay on. Nothing here needs them today.
- Client addresses: Caddy trusts `CF-Connecting-IP` only from Cloudflare's
  published ranges (listed in the Caddyfile; re-check them yearly) and passes
  Medusa a single `X-Forwarded-For`, so rate limits apply per shopper and
  cannot be spoofed.

### Neon

1. Create a project in the region nearest the VPS, e.g. AWS `eu-central-1`
   (Frankfurt) for an OVH Gravelines, Strasbourg or Frankfurt server. Keep it
   separate from the development project (currently `us-east-2`).
2. Copy the **direct** connection string (host without `-pooler`) into
   `DATABASE_URL` in `backend.env`, changing its `sslmode=require` to
   `sslmode=verify-full`. The `pg` driver treats `require` as `verify-full`
   today but warns that it will stop checking the certificate in a future
   release; `verify-full` keeps the check and silences the warning.
3. On a paid plan, disable scale-to-zero for the production branch. Otherwise
   the first request after an idle spell waits for the compute to wake.
4. Set the restore window (point-in-time recovery). It is the only backup of
   business data; see [production-operations.md](./production-operations.md).

`db:migrate` enables the `pg_trgm` and `unaccent` extensions the search index
needs; Neon supports both.

### GitHub

1. Create an Environment (Settings → Environments), e.g. `production`:
   - **Deployment branches and tags:** `main` and your release tags only.
   - Required reviewers are optional. The workflow is already manual, and
     several of its jobs use the environment, so a reviewer would approve
     each of them.
   - Secrets: `DEPLOY_HOST`, `DEPLOY_USER` (`deploy`), `DEPLOY_SSH_KEY` (the
     private half of the deploy key), `DEPLOY_KNOWN_HOSTS` (output of
     `ssh-keyscan -t ed25519 <host>`, checked against the server's real
     fingerprint).
   - Variables: `DOMAIN` (e.g. `example.com`), `IMAGE_REMOTE_URLS` (the
     `S3_FILE_URL` origin, comma-separated with any other image hosts). Also
     `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`, which you only get during the first
     deployment.
2. **GHCR access.** Images are pushed to `ghcr.io/<owner>/<repo>/*` with the
   workflow's own token and stay private. The VPS never holds a GitHub
   credential. Each deploy job passes it that job's token, restricted to
   `packages: read`, which expires when the job ends. `deploy.sh` logs out
   afterwards. The first time the packages exist, check each one under
   Package settings → Manage Actions access: this repository must be listed
   (it is by default for packages the repository pushed).

This fits client ownership. The client's VPS pulls only these images, only
during a deploy you run, and needs no GitHub account or source access. You
hold the deploy key; the client can revoke it by removing it from
`authorized_keys`. Note that the images contain the compiled application, with
inline source maps. Anyone with root on the VPS can read that code.

## First deployment

From an empty Neon database to a live store:

1. **Configure** the VPS (`.env`, `backend.env` including `ADMIN_EMAIL` and
   `ADMIN_PASSWORD`), DNS (DNS-only), Neon and the GitHub Environment as
   above. Leave `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY` unset.
2. **Backend bootstrap:** Actions → Deploy → Run workflow, from `main`, with
   the environment and **backend_only** ticked. It runs CI, builds the
   backend and admin images, then on the VPS:
   - starts Redis and Caddy (certificates are issued now);
   - runs `medusa db:migrate --skip-scripts --execute-safe-links
     --all-or-nothing`, which creates the schema and the search index tables;
   - runs `medusa db:migrate:scripts`, the seed scripts. These create the
     sales channel, the publishable API key, NGN/USD, the Nigeria region with
     Credo and Paystack, the Lagos stock location, RBAC roles, the search
     vocabulary, and the Super Admin from `ADMIN_EMAIL`/`ADMIN_PASSWORD`. A
     failed seed stops the deploy here (see [Migrations](#migrations));
   - starts `medusa-server`, `medusa-worker` (which fills the search index)
     and `admin`, then checks `api.` and `admin.` publicly.
3. **Publishable key:** copy the `Publishable API key token: pk_...` line from
   the "Migrate and roll out" step's log into the Environment variable
   `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`. (Later, find it in the dashboard
   under Settings → Publishable API Keys.)
4. **Tidy up:** remove `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `backend.env`.
   Sign in at `https://admin.<domain>`.
5. **Full deployment:** run the workflow again without backend_only. It
   redeploys the backend (no pending migrations), builds the storefront
   against `https://api.<domain>` with the key, deploys it, and checks all
   three hostnames.
6. Switch the Cloudflare records to proxied, and set the webhook URLs in
   the provider dashboards:
   - Paystack: `https://api.<domain>/hooks/payment/paystack_paystack`
   - Credo: `https://api.<domain>/hooks/payment/credo_credo`
   - Resend: `https://api.<domain>/webhooks/resend` (see
     [resend-webhooks.md](./resend-webhooks.md))
7. Work through [Before going live](#before-going-live).

## Normal deployments

Merge to `main`, then run the Deploy workflow for the environment. It:

1. runs CI (`ci.yml`: backend build with lint and type-check, unit tests,
   migrations twice on a scratch database, HTTP integration tests;
   storefront type-check, lint and tests);
2. builds and pushes `backend:<sha>` and `admin:<sha>-<env>`;
3. on the VPS (`deploy.sh backend <sha>`): pulls, migrates and then runs the
   migration scripts with a one-off container of the new image while the old
   version keeps serving, restarts server, worker and admin, checks the API's
   readiness (`/health`, see [Health checks](#health-checks)) and the admin
   through Caddy, rolling back if either fails, then checks `api.` and
   `admin.` publicly;
4. builds `storefront:<sha>-<env>` against the API just deployed;
5. on the VPS (`deploy.sh storefront <sha>`): same pattern, then checks all
   three hostnames publicly.

Any failure stops the workflow and shows red. Two runs for the same
environment queue rather than overlap, and `deploy.sh` also takes a lock on
the host. Caddy config changes ship with the deploy and are applied with
`caddy reload`, without dropping connections.

To deploy automatically on every merge later, add a `push` trigger to
`deploy.yml`. No other change is needed.

## Migrations

- `db:migrate` runs once per backend deploy, in its own container, in
  `server` worker mode (it consumes no jobs). Neither Medusa service runs
  migrations on boot.
- `--all-or-nothing` reverts the migrations of a run that fails partway; the
  running version is left untouched and the deploy stops.
- `--execute-safe-links` applies link changes that drop nothing. A link
  removal that would drop data is reported and skipped. Run it deliberately
  on the host (`docker compose run --rm medusa-server medusa db:sync-links`)
  after checking what it drops.
- Search-index changes (a new field in `src/search/*.ts`) are rebuilt by
  `db:migrate`; the worker refills the index when it starts.
- **Migration scripts run as their own step** (`db:migrate:scripts`), after
  the schema migrations. Medusa 2.20 runs them from `db:migrate` too, but
  discards their exit code, so a failed seed would otherwise let the release
  go out on a half-seeded database. A failure stops the deploy with the old
  version still serving. The schema migrations before it stay applied, which
  backward-compatible migrations make safe. Completed scripts are recorded
  and skipped; a failed one runs again on the next deploy, so write scripts
  that can be re-run after a partial failure.

## Health checks

`https://api.<domain>/health` answers `200` only when the server can reach
both Postgres (`select 1`) and Redis (taking and releasing a lock), each within
two seconds; otherwise `503`. The body names each dependency's state and
nothing else:

```json
{ "status": "ok", "checks": { "database": "ok", "redis": "ok" } }
```

It replaces Medusa's built-in `/health`, which answers `200` whenever the
process is up. The deploy's rollback, the public checks and the uptime probe
all read it, so a release that cannot reach its database now fails the deploy
instead of going live. `redis` reads `not_configured` without `REDIS_URL`
(local development). The worker has no HTTP route and is not covered yet.

The storefront's `/api/health` stays a liveness check: it answers without
calling Medusa, so a backend restart does not also mark the storefront down.
- **Migrations run before the new code starts**, so for a short time the old
  code runs against the new schema. Keep migrations backward compatible: add
  columns and tables first, remove them in a later release. Migrations are
  forward-only. A code rollback does not undo them, and there is no automatic
  schema rollback. Neon's point-in-time restore is the last resort for a
  destructive mistake.

## Rollback

`deploy.sh` rolls back on its own when the new version fails its health
checks: it restarts the previous tag and exits non-zero. To roll back a
version that deployed fine but misbehaves, on the VPS:

```sh
cd /opt/store
./deploy.sh status                       # current and previous tags
./deploy.sh backend <previous-sha>       # server, worker and admin
./deploy.sh storefront <previous-sha>
```

The previous images are kept on the host, so this needs no registry login.
Anything older can be deployed from GitHub: tag the commit and run the
workflow from the tag. Remember that migrations are not rolled back.

## Operating it

Everything below runs in `/opt/store` as the deploy user (or with `sudo`).

**Logs.** Medusa and Next.js log to stdout. Medusa writes one JSON object per
line in production. Docker keeps five 10 MB files per container.

```sh
docker compose logs -f --tail=200 medusa-server
docker compose logs -f medusa-worker        # emails, jobs, search indexing
docker compose logs --since=1h storefront caddy
```

Caddy writes no access log. Request URLs carry search terms and one-time
tokens, which the log-retention policy keeps out of logs. To debug routing,
add a `log` directive to a site block temporarily and reload.

**Status and restarts.**

```sh
docker compose ps                    # health of every service
docker compose restart medusa-worker # one service, same version
docker compose up -d                 # after a reboot or edit, recreate what changed
```

Every service has `restart: unless-stopped`, and Docker starts at boot, so a
reboot brings the stack back by itself.

**Updating secrets or runtime settings.** Edit `backend.env`, then recreate
the two Medusa services. `restart` does not reread env files.

```sh
docker compose up -d --force-recreate medusa-server medusa-worker
```

Build-time values (anything `NEXT_PUBLIC_*`, `IMAGE_REMOTE_URLS`, `DOMAIN`)
change in the GitHub Environment and need a new deploy.

**Admin users.** Invite from the dashboard, or create one on the host:

```sh
docker compose run --rm medusa-server medusa user -e someone@example.com -p '<password>'
```

**State on the VPS.**

| Data                                                    | Where                                  | If lost                                                                     |
| ------------------------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------- |
| Orders, customers, catalogue, search index              | Neon                                   | Not on the VPS; covered by Neon's restore window                            |
| Uploaded images and files                               | S3/R2 bucket                           | Not on the VPS                                                              |
| Queued jobs, in-flight workflows, admin sessions, cache | `redis_data` volume (append-only file) | Pending emails and retries are lost; admins sign in again. No business data |
| TLS certificates, ACME account                          | `caddy_data` volume                    | Reissued automatically, subject to Let's Encrypt rate limits                |
| Configuration and secrets                               | `.env`, `backend.env`                  | Keep a copy in a password manager                                           |

No local backup job is needed. Back up the two env files, and snapshot the
VPS through OVH if you want faster rebuilds.

**Troubleshooting.**

| Symptom                                        | Look at                                                                                                                            |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Certificates not issued                        | `docker compose logs caddy`. DNS must point at the VPS, port 80 must be reachable, and Cloudflare's Always Use HTTPS must be off   |
| 502 from one hostname                          | `docker compose ps`; the upstream is unhealthy or restarting                                                                       |
| Deploy fails at migrations                     | Workflow log of "Migrate and roll out"; the old version is still serving                                                           |
| Admin sign-in fails, CORS error in the browser | `ADMIN_CORS` and `AUTH_CORS` must be exactly `https://admin.<domain>`. The admin image must have been built for the right `DOMAIN` |
| Search returns nothing                         | `docker compose logs medusa-worker \| grep Search`; the worker seeds the index at start                                            |
| Emails not sending                             | Worker logs; `docker compose exec redis redis-cli info memory` (writes fail if the 512 MB cap is reached)                          |
| Storefront build fails in the workflow         | It fetches from `https://api.<domain>`: the API must be up, and not challenged by Cloudflare                                       |

## Error tracking and uptime

- Sentry is inert without a DSN. Set `SENTRY_DSN` in `backend.env`; the release
  is the commit SHA. For the storefront, set `NEXT_PUBLIC_SENTRY_DSN` and,
  for readable stack traces, `SENTRY_ORG`, `SENTRY_PROJECT` (variables) and
  `SENTRY_AUTH_TOKEN` (secret) on the Environment.
- `.github/workflows/uptime.yml` probes the repository variable `HEALTH_URL`
  (`https://api.<domain>/health`) every 15 minutes and opens an issue when it
  fails. It is a backstop: pair it with an external monitor on
  `https://<domain>/api/health` and `https://api.<domain>/health`.

## Before going live

- [ ] A test order end to end with live payment keys, including the payment
      callback and webhooks.
- [ ] Order confirmation, cart reminder and password reset emails arrive.
- [ ] `robots.txt` and `sitemap.xml` show the real domain, and indexing is
      allowed in the dashboard.
- [ ] Neon restore window set, and a restore drill done
      ([production-operations.md](./production-operations.md)).
- [ ] An external uptime monitor, and Sentry receiving an error from each app.
- [ ] Cloudflare records proxied, and all three hostnames verified afterwards.
- [ ] `ADMIN_EMAIL`/`ADMIN_PASSWORD` removed from `backend.env`, and
      `backend.env` backed up.
