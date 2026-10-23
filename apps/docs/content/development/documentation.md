---
title: Maintain this handbook
---

# Maintain this handbook

**Audience:** everyone changing a customer or operator workflow.

**Prerequisites:** the implemented behavior, a verified source and a clear
audience. Documentation changes are part of delivering the feature.

## Add or change a guide

1. Find the matching scenario in `content/scenarios.md` or add a new ID.
2. Update the relevant Markdown guide under `apps/docs/content` and its sidebar
   entry in `.vitepress/config.mjs` if adding a page.
3. Include actor, prerequisites, normal steps/result, failures/recovery and a
   verification procedure. Say which actions are manual or configuration-dependent.
4. Link related customer and staff procedures so both sides of a transaction
   remain consistent.
5. Run docs lint/build and inspect the rendered page and search result.

Do not promise every possible future incident is covered. Record known cases,
make gaps explicit and add new scenarios when real incidents reveal them.
Avoid screenshots containing customer information, credentials or transient
UI state that cannot be maintained.

## Source runbooks and generated reference

`scripts/sync-reference.mjs` imports named runbooks from the repository's `docs/`
directory. Edit those original files, then run `pnpm run sync` or rebuild. Files
under `content/reference/generated` and the copied API contract are generated
and ignored by Git.

The custom API reference is derived from `docs/api/openapi.json`. Change API
registration/validators in the backend and run its codegen; never hand-edit the
generated contract, shared type package or generated docs reference. Native
Medusa API behavior should be checked against the installed version and its
official documentation.

Brand tokens under `.vitepress/theme/generated` come from the storefront's
stylesheet. Edit that shared source, then sync/build. The admin-managed logo
is loaded at runtime; see [docs hosting](/operations/docs-hosting#brand-colors-and-the-admin-logo).

## Quality checks

```sh
cd apps/docs
pnpm run lint
pnpm run build
pnpm run start
```

The content check rejects missing titles and unfinished placeholder text. The
production build checks internal links and generates the local search index.
Check mobile navigation, keyboard search, code examples, tables and deep links.
Update operational procedures whenever a schema, environment variable, retry
policy or recovery action changes.

## Internal access

Keep noindex metadata and robots restrictions, but require authentication at
hosting for every file. Search indexes and API downloads contain internal
documentation too. Do not publish a public preview of this handbook to obtain
feedback; use the approved internal access path in [docs hosting](/operations/docs-hosting).
