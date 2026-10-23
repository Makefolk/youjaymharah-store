---
title: Local setup and commands
---

# Local setup and commands

**Audience:** developers.

**Prerequisites:** the repository, Node matching
`.nvmrc`/the package engines, the root `packageManager` version, PostgreSQL 15
for integration work, and local configuration created from templates. Never
copy production data or secrets into a development walkthrough.

## Install and run

```sh
nvm use
corepack enable
pnpm install --frozen-lockfile
pnpm run backend:dev
```

Run the storefront in another terminal with `pnpm run storefront:dev` and the
docs with `pnpm run docs:dev`. Expected development ports are backend/admin 9000,
storefront 8000 and docs 8001. The docs build independently of the backend.

Configure the backend from its `.env.template` and the storefront from its own
template. Use a local/test database, test gateway credentials, a test email
recipient/provider setup and non-production storage. The storefront needs the
correct publishable key and a region before real catalog/checkout checks work.

Apply migrations only to the intended development database. Initial migration
scripts create baseline store configuration, not a finished catalog and shipping
setup. Do not run a seed repeatedly to repair an unrelated error.

## Commands

| Task                                    | Command and directory                                                                          |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Backend build, framework lint and types | `cd apps/backend` then `pnpm run build`                                                        |
| Backend unit tests                      | `cd apps/backend` then `pnpm run test:unit`                                                    |
| Isolated database/HTTP suite            | `cd apps/backend` then `pnpm run test:isolated`                                                |
| One isolated HTTP suite                 | `pnpm run test:isolated --tests-only integration-tests/http/payment-safety.spec.ts` in backend |
| Storefront tests/lint                   | `pnpm run test` and `pnpm run lint` in storefront                                              |
| Storefront route types/type check       | `pnpm exec next typegen` then `pnpm exec tsc --noEmit` in storefront                           |
| API generation/freshness                | `pnpm run codegen` or `pnpm run codegen -- --check` in backend                                 |
| Docs checks/build                       | `pnpm run lint` and `pnpm run build` in docs                                                   |
| Formatting selected files               | `pnpm exec prettier --write <paths>` from the root                                             |

The isolated test script starts a temporary PostgreSQL cluster on a random port,
uses fake provider configuration and removes its own cluster afterward. Set
`POSTGRES_BIN` if PostgreSQL 15 is installed outside its recognized locations.
Ordinary integration commands need a reachable test database and must never
target production.

## Common setup failures

| Failure                                       | Check                                                                             |
| --------------------------------------------- | --------------------------------------------------------------------------------- |
| Package/engine errors                         | Active Node and pnpm versions; use one lockfile                                   |
| Storefront pages fail but `/api/health` works | Backend readiness, backend URL, publishable key, region and generated build state |
| Publishable-key error                         | Correct key and sales-channel assignment                                          |
| Product images fail                           | `IMAGE_REMOTE_URLS` and the actual image origin                                   |
| Redis URL cannot parse                        | URI syntax, scheme and accidental copied command text; do not print its secret    |
| Integration tests fail to connect             | Isolated PostgreSQL tools/permissions or the explicitly selected test database    |

Verify setup by opening the store, admin and docs, then running focused tests
for the area you will change. Medusa skills improve framework-specific work
when available; installed package types remain the exact-version reference.
