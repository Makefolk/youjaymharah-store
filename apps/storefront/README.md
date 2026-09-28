# Storefront

The Youjaymharah store's Next.js storefront. It talks to the Medusa backend in
`apps/backend` and, in production, runs on the same VPS behind Caddy; see
[docs/deployment.md](../../docs/deployment.md).

## Running it locally

1. Install from the repository root (pnpm only; the lockfile is authoritative):

   ```bash
   pnpm install
   ```

2. Copy `.env.template` to `.env.local` and fill it in. The publishable key
   comes from the admin under Settings › Publishable API Keys.
3. Start the backend and the storefront together from the root, or the
   storefront alone:

   ```bash
   pnpm dev              # backend and storefront
   pnpm storefront:dev   # storefront only, with the backend already running
   ```

   The storefront runs at <http://localhost:8000>. Most pages need the
   backend: the root layout loads settings, categories and collections from
   it.

## Checks

From `apps/storefront`:

```bash
pnpm lint
pnpm test                 # vitest
pnpm exec next typegen    # route types, before a type-check
pnpm exec tsc --noEmit
```

## Where things are documented

| Topic                                              | Read                                           |
| -------------------------------------------------- | ---------------------------------------------- |
| How pages fetch data and call Medusa               | [DATA-LAYER.md](./DATA-LAYER.md)               |
| Design system: colour, type, layout, components    | [style-guide.md](./style-guide.md)             |
| The production image and backend settings it needs | [DEPLOY.md](./DEPLOY.md)                       |
| Production deployment and operations               | [docs/deployment.md](../../docs/deployment.md) |
| Notes for coding agents (Next.js version caveats)  | [AGENTS.md](./AGENTS.md)                       |
