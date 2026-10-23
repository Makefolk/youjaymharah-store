# Internal team docs

From the repository root, run `pnpm run docs:dev` and open
http://localhost:8001. Run `pnpm run docs:build` to produce `apps/docs/dist`.
From this directory, `pnpm run start` previews that build on localhost:8001.

The site uses VitePress with local search, responsive navigation, light/dark
themes and printable Markdown guides. The guides work without the Medusa backend.
The build imports selected maintained runbooks and regenerates the API reference
from the existing OpenAPI contract. No production configuration is read during builds.

Colors come from `apps/storefront/app/globals.css`, including its dark theme.
The header and favicon use the branding saved in the admin. Development and
preview reuse the local storefront's backend URL and publishable key, or the
`DOCS_MEDUSA_BACKEND_URL` / `DOCS_MEDUSA_PUBLISHABLE_KEY` overrides in the docs
environment. No admin credentials are needed. Reload after changing branding;
returning to the tab also refreshes it, at most once per minute. If the backend
or image cannot be loaded, the header keeps a readable brand-name fallback.

See `AGENTS.md` for authoring rules. Deployment must authenticate every request,
including search assets and `/api/openapi.json`. Robots and noindex settings are
not access controls. `Dockerfile` and `Caddyfile` provide a static container that
requires HTTP basic authentication; put it behind HTTPS or the team's existing
access gateway. For live branding, set the two `DOCS_MEDUSA_*` variables on the
runtime container; the backend URL must be an origin reachable from that
container. See `content/operations/docs-hosting.md`. No hosting is published by
the docs build.
