# Internal documentation

Run the app from this directory with `pnpm run dev` (localhost:8001),
`pnpm run build`, or `pnpm run lint`. Use the workspace Node and pnpm versions.

Write maintained guides in `content/`. Every guide must identify the relevant
actor, prerequisites, normal result, failure/recovery paths and verification.
Put Audience and Prerequisites in separate paragraphs, with a blank line between.
Describe implemented behavior and mark manual or unavailable behavior explicitly.
Update `content/scenarios.md` whenever a customer or operator workflow changes.

`scripts/sync-reference.mjs` imports the maintained repository runbooks and
generates the custom API reference from `docs/api/openapi.json`. Do not edit
`content/reference/generated/` or `content/public/api/` by hand.

Brand colors are generated from `apps/storefront/app/globals.css`; do not edit
`.vitepress/theme/generated/`. The header uses the public storefront settings
through the docs server. Never connect the browser to an authenticated admin API.

This site is internal. Keep indexing disabled. Hosting must authenticate all
requests, including assets, search indexes and downloadable API contracts.
No credentials, customer data, production screenshots or private tokens belong
in documentation. Do not publish the site as part of writing it.
