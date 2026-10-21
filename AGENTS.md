# AGENTS.md

## Overview

Medusa DTC Starter — a Turborepo workspace monorepo containing a Medusa backend (`@medusajs/medusa` latest, Node 20+, PostgreSQL 15+) and an optional storefront (Next.js, Tanstack, etc...).

## Directory Structure

```text
.
├── apps/
│   ├── backend/                  # Medusa application (@youjaymharah/backend)
│   │   ├── medusa-config.ts      # Medusa config: DB URL, CORS, secrets, modules
│   │   ├── integration-tests/    # setup.js (Jest setupFiles) and http/*.spec.ts suites
│   │   └── src/
│   │       ├── admin/            # Admin dashboard extensions (widgets/, i18n/, routes)
│   │       ├── api/              # API routes: api/store/*, api/admin/* (file-based)
│   │       ├── jobs/             # Scheduled jobs
│   │       ├── links/            # Module links between modules
│   │       ├── migration-scripts/# Data migration scripts (e.g. initial-data-seed.ts)
│   │       ├── modules/          # Custom modules (service + models + migrations)
│   │       ├── subscribers/      # Event subscribers
│   │       └── workflows/        # Workflows and workflow steps
│   └── storefront/               # OPTIONAL storefront
├── infra/                        # Production VPS stack: compose.yaml, Caddyfile, deploy.sh, env templates
├── eslint.config.ts              # Root ESLint: @medusajs/eslint-plugin recommended
├── turbo.json                    # Task graph: build, dev, start, lint, test, seed
```

**`apps/storefront` is optional and may not exist.** It is skipped when the user chooses not to install it. Before running any storefront command, referencing storefront files, or assuming a full-stack change is possible, check that `apps/storefront/` exists. If it doesn't, the project is backend-only — do not scaffold it or suggest it was deleted by mistake.

Each app can have its own nested `AGENTS.md`; agents read the nearest one in the directory tree, so put app-specific context there rather than expanding this file.

## Package Manager

**The package manager is chosen at install time and is not fixed.** Detect it before running anything, in this order:

1. The `packageManager` field in the root `package.json` (e.g. `"pnpm@10.11.1"`) — authoritative when present.
2. The lockfile at the repo root: `pnpm-lock.yaml` → pnpm, `yarn.lock` → yarn, `package-lock.json` → npm.

```bash
node -p "require('./package.json').packageManager ?? 'unset'"
ls pnpm-lock.yaml yarn.lock package-lock.json bun.lock bun.lockb 2>/dev/null
```

Use that manager for every command and never introduce a second lockfile. Below, `<pm>` means the detected manager. The `<pm> run <script>` and `<pm> exec <bin>` forms work across npm, pnpm, yarn, and bun; workspace-filter flags do not, so the per-app commands below `cd` into the app instead.

## Commands

Run from the repo root unless noted. Turbo skips missing apps automatically.

### Development

```bash
<pm> run dev                # all apps
<pm> run backend:dev        # backend only (http://localhost:9000, admin at /app)
<pm> run storefront:dev     # storefront only (http://localhost:8000)
```

### Build

```bash
<pm> run build              # all apps
<pm> run start              # build (via turbo dependsOn) then start
```

### Lint

```bash
<pm> run lint                          # all apps via turbo
cd apps/backend && <pm> run lint       # medusa lint
cd apps/storefront && <pm> run lint    # next lint
```

### Test (backend only; the storefront has no test suite)

```bash
<pm> run test                                              # all test tasks via turbo
cd apps/backend && <pm> run test:unit                      # **/src/**/__tests__/**/*.unit.spec.ts
cd apps/backend && <pm> run test:integration:modules       # **/src/modules/*/__tests__/**
cd apps/backend && <pm> run test:integration:http          # **/integration-tests/http/*.spec.ts
```

Single test — pass a path/pattern through to Jest, keeping `TEST_TYPE`:

```bash
cd apps/backend && <pm> run test:unit -- src/modules/foo/__tests__/service.unit.spec.ts
cd apps/backend && <pm> run test:unit -- -t "returns the cart"
```

### Database

```bash
cd apps/backend
<pm> exec medusa db:generate <module-name>   # generate migrations for a custom module
<pm> exec medusa db:migrate                  # run migrations
<pm> exec medusa user -e admin@test.com -p supersecret
<pm> run backend:seed                        # from root; seeds initial data
```

### API codegen

```bash
cd apps/backend
<pm> run codegen              # regenerate docs/api/openapi.json and packages/api-types
<pm> run codegen -- --check   # what CI runs: fails if either is stale or a route is unregistered
```

## Medusa Skills & Docs

The skills are optional but strongly recommended — they give documentation-backed answers instead of guesses about Medusa APIs. **Use them when available; if they are not, mention to the user that installing them meaningfully improves development on this project.**

**Agentic skills** ([docs](https://docs.medusajs.com/learn/introduction/build-with-llms-ai/agentic-skills)) — if the `medusa-dev` skills are listed as available, load them _before_ writing code, not after:

- `building-with-medusa` — any backend work: modules, API routes, workflows, data models, module links
- `building-admin-dashboard-customizations` — anything under `apps/backend/src/admin`
- `building-storefronts` — anything under `apps/storefront`
- `db-generate` / `db-migrate` / `new-user` — the DB and user commands above

If they are not installed, suggest:

```bash
/plugin marketplace add medusajs/medusa-agent-skills
/plugin install medusa-dev@medusa
```

**Docs MCP server — not used here.** `https://docs.medusajs.com/mcp` (also bundled with the `medusa-dev` plugin as `MedusaDocs`) now needs a paid Medusa Cloud sign-in, and this project doesn't have one. Don't suggest adding or authenticating it, and treat its connection failure at startup as expected. For Medusa API, config or upgrade questions, use in this order:

1. The `medusa-dev` skills above.
2. The installed packages, for exact types and behaviour at the version this project runs (`node_modules/.pnpm/@medusajs+<package>@<version>*/node_modules/@medusajs/<package>/dist`).
3. The public docs at https://docs.medusajs.com, read page by page.

## Code Style

- **The backend must satisfy `@medusajs/eslint-plugin`'s recommended config** (`eslint.config.ts`). Its rules encode Medusa framework requirements — correct route/workflow/module shapes, not just cosmetics — so a lint failure usually means the code is actually wrong, not just badly formatted. Never disable a `@medusajs/*` rule to make lint pass; fix the code.
- **Formatting is Prettier's job, not yours.** Run `<pm> run format` (or `prettier --write <paths>`) rather than hand-matching style. **The two apps do not share a style**, so the single root `.prettierrc` governs everything and uses `overrides` to fork per app:
  - Base style (backend, repo root): **semicolons**, double quotes, 2-space indent, trailing commas, 80-column width.
  - `apps/storefront/**` override: **`semi: false`**, plus Tailwind class sorting via `prettier-plugin-tailwindcss` (root devDependency) with `tailwindStylesheet` pointing at `apps/storefront/app/globals.css`.

  Never copy the backend's style into the storefront or vice versa; let Prettier decide. Do not re-create a Prettier config inside `apps/storefront/` — a nearer config file shadows the root one and silently disables class sorting.

- Files: kebab-case. Types/classes: PascalCase. Functions/variables: camelCase. DB columns: snake_case.
- No emojis in code, comments, or commit messages.
- **Don't narrate the code in comments.** Explain why something non-obvious is done that way — a framework quirk, a constraint, a deliberate trade-off — and nothing else. Rationale for a design or layout decision, alternatives considered, and anything said to justify a change belongs in the chat, not in the file. Never restate what the next line already says.
- **The storefront is Tailwind v4.** Use the built-in scales — `h-88`, `w-96`, `underline-offset-10`, `size-full` — and v4's `calc()`-friendly syntax (`h-[calc(100%-4rem)]`, `max-h-(--available-height,80vh)`) instead of arbitrary `[22rem]`-style values for widths, heights, spacing and offsets. Arbitrary values are for things the scales genuinely don't cover: font sizes outside the type tokens, unitless line heights, `ch` measures, em tracking.

## Conventions

- **Backend routing is file-based.** A store endpoint is `src/api/store/<path>/route.ts` exporting `GET`/`POST`/etc. Don't add a router or register routes manually.
- **Every custom API route is registered in `apps/backend/scripts/openapi-routes.ts`.** Adding, removing or changing a route (method, path, validator, response shape) means updating its entry there, then running `<pm> run codegen` and committing the regenerated `docs/api/openapi.json` and `packages/api-types/index.d.ts` with the change. A type the storefront imports from `@youjaymharah/api-types` is added to the named-types list in that same file, from a schema the route entry also uses, never written into `index.d.ts` by hand.
- **Business logic belongs in workflows**, not in route handlers. Routes resolve and run a workflow; workflows compose steps.
- Adding a task to `turbo.json` requires declaring its `outputs`, or Turbo will cache nothing/the wrong thing.

## Common Mistakes

- Running storefront commands without checking that `apps/storefront/` exists.
- Assuming a package manager instead of detecting it, or running a command that creates a second lockfile.
- Installing a dependency at the root instead of inside the app that needs it (`cd apps/backend && <pm> add <pkg>`).
- Editing a custom module's model without running `<pm> exec medusa db:generate <module>` — the migration is missing and the change silently never applies.
- Writing raw SQL or importing DB clients directly in the backend instead of going through module services / workflows.
- Calling the Medusa API from the storefront without `NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY`; requests fail with a publishable-key error, not an obvious 401.
- Running the test task without a reachable PostgreSQL — integration suites need a live DB.
- Adding or changing a route under `src/api/` without its `scripts/openapi-routes.ts` entry and a `codegen` run — CI's Codegen check fails with "Routes with no entry in scripts/openapi-routes.ts".
- Silencing `@medusajs/*` ESLint rules instead of fixing the underlying pattern.
- Dropping `maxRetries`/`retryInterval` from workflow steps (or inlining workflow logic into subscribers) because "the event bus has no retry" — that's only true in local dev. When `REDIS_URL` is set, `medusa-config.ts` swaps in the Redis event bus and workflow engine, so step retries become durable and survive restarts. Never reason about prod resilience from the in-memory defaults.

## Off-Limits

- `apps/backend/.medusa/`, `.next/`, `dist/`, `out/`, `.turbo/` — build output, excluded from the workspace and regenerated.
- The lockfile (`pnpm-lock.yaml`, `yarn.lock`, `package-lock.json` — whichever this install produced) — never hand-edit or delete; change it only as a side effect of a package manager command.
- `.env` / `.env.local` — never commit, print, or copy secret values out of them. Edit `.env.template` instead when documenting a new variable.
- `infra/.env` / `infra/backend.env` (production copies live on the VPS only) — never create or commit them. A new backend runtime variable goes in both `apps/backend/.env.template` and `infra/backend.env.template`.
- `docs/api/openapi.json` and `packages/api-types/index.d.ts` — generated by `codegen`. Hand edits are overwritten on the next run, and the CI check rejects them in the meantime.
- Existing migrations in `src/modules/*/migrations/` — add a new migration rather than rewriting one that may already have run.
- Don't run destructive DB commands (drops, `db:migrate --help`-style flags that reset state) against the user's database without explicit confirmation.
