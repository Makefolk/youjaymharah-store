---
title: Host the internal docs
---

# Host the internal docs

**Audience:** operators.

**Prerequisites:** an internal hostname or restricted
network, TLS, an access owner and a deployment revision. The docs build is static
and does not need database, payment or email credentials. Live branding uses
only the Store API's publishable key.

## Local development and preview

From the repository root:

```sh
pnpm run docs:dev
pnpm run docs:build
```

Development opens on `http://localhost:8001`. To preview the compiled output:

```sh
cd apps/docs
pnpm run start
```

Both commands bind to localhost. Local search works from the generated site;
it does not send searches to an external hosted search provider.

## Brand colors and the admin logo

Both themes copy the storefront's black, ivory and gold tokens when syncing or
building the docs. During development, editing the storefront palette also
updates the docs. Keep palette changes in `apps/storefront/app/globals.css`.

The header loads the name, logo and favicon saved in the admin's Branding
settings through the same public settings endpoint used by the storefront.
No admin login token is used or exposed. The logo uses the storefront's
monochrome treatment so it stays visible in both themes.

Local development and preview reuse the storefront's backend URL and publishable
key from its local environment. To use a different backend, set
`DOCS_MEDUSA_BACKEND_URL` and `DOCS_MEDUSA_PUBLISHABLE_KEY` in the docs environment;
see `apps/docs/.env.template`. The URL is the backend origin, without an API path.
The key must belong to the intended store's sales channel.

Reload the page after changing Branding, or return to the tab after a minute.
No docs rebuild is needed for logo changes. If the backend or logo is unavailable,
the guides still open and the header falls back to the brand name.

## Authenticated hosting

Build the provided container from the repository root:

```sh
docker build -f apps/docs/Dockerfile -t youjaymharah-docs:review .
```

The runtime serves static files on port 8080 and requires `DOCS_USERNAME` and
`DOCS_PASSWORD_HASH` through the deployment secret store. Generate the password
hash with Caddy's interactive `hash-password` command, so a password is not
placed in shell history. Keep these runtime values out of source control.

For live branding, also supply `DOCS_MEDUSA_BACKEND_URL` and
`DOCS_MEDUSA_PUBLISHABLE_KEY` to the container at runtime. On the application
Docker network the URL can be `http://backend:9000`; otherwise use its approved
HTTPS origin. The docs proxy exposes only the fixed public settings route and
strips docs authentication and cookies before contacting Medusa. Store CORS
changes are unnecessary because the browser calls the docs origin. Uploaded
logo/favicon URLs must be publicly readable over HTTPS in production.

Place the container behind HTTPS and the team's approved network/access policy.
Use a per-user identity gateway for managed team access when available; the
container's basic authentication provides a minimal closed access boundary.
Bind any temporary local container port only to `127.0.0.1`.

Do not expose the static `dist` directory through an unauthenticated bucket,
CDN or default hosting URL. Authentication must cover HTML, assets, local-search
indexes, source downloads, `/api/branding` and `/api/openapi.json`. A private navigation menu,
robots file and noindex metadata do not provide access control.

## Verification

1. Request the homepage, a nested guide, a search asset and API JSON without
   credentials; all must be refused by the access layer.
2. Sign in through the approved access path and verify navigation, deep links,
   local search, dark mode, mobile layout and the 404 page.
3. Confirm TLS, noindex headers and that public caching does not retain
   authenticated content.
4. Remove a user's access and verify it no longer works. For shared basic
   authentication, rotate the shared credential when membership changes.

Deploy documentation with the matching application procedures and keep the
previous static image for rollback. A docs rollback does not change application
state. Publishing the site is a separate deployment action from building it.
