---
title: Architecture and conventions
---

# Architecture and conventions

**Audience:** developers.

**Prerequisites:** read the root and nearest app
`AGENTS.md`, understand the affected customer/staff scenario, and identify the
active package versions before using framework APIs.

## Application boundaries

| Component            | Responsibility                                                                |
| -------------------- | ----------------------------------------------------------------------------- |
| `apps/backend`       | Medusa API, admin extensions, custom modules, workflows, events and jobs      |
| `apps/storefront`    | Next.js customer UI, server-side reads, cookie-bound auth and Store API proxy |
| `apps/docs`          | Internal static handbook and generated custom API reference                   |
| `packages/api-types` | Generated contract types consumed by the storefront                           |
| `infra`              | Containers, proxy, runtime templates and deployment tooling                   |

The browser reaches Medusa through the storefront's Store API proxy for customer
requests. Customer auth tokens remain in HttpOnly cookies. Admin uses its own
authenticated API path. Never forward arbitrary browser headers or expose an
admin credential in storefront JavaScript.

## Backend change workflow

1. Define validated input and the expected response and permission boundary.
2. Put business operations in a workflow and steps. File-based route handlers
   resolve/run that workflow and shape the response.
3. Access records through module services and the query layer. Do not add raw
   SQL or independent database clients for ordinary business logic.
4. Register every custom route in `scripts/openapi-routes.ts`; regenerate the
   OpenAPI file and shared types. Never hand-edit generated artifacts.
5. Add the appropriate authorization/ownership, abuse limits and idempotency
   behavior, then meaningful regression coverage.

For model changes, generate a new migration for the module against an isolated
database. Preserve migrations that may already have run. Check repeat migration
and upgrade compatibility before deployment.

## Events, jobs and external effects

Production uses Redis-backed event/workflow infrastructure when configured.
Keep durable step retries and their idempotency boundaries. Subscriber/job
handlers should invoke workflows rather than embed substantial business logic.

Gateway charges/refunds and accepted emails cannot be rolled back like a local
database write. Record durable references, distinguish unknown from failed
outcomes and provide reconciliation. Test restart and duplicate-delivery cases
instead of relying only on local in-memory infrastructure.

## Storefront and admin

Read the installed Next.js guides before changing route, cache or metadata
behavior. Use the shared generated API types, existing SDK wrappers and cookie
helpers. Keep per-customer reads uncached. Respect the storefront's Tailwind v4
and formatting conventions.

Admin widgets/routes must use the established permission wrapper and backend
RBAC checks. Hiding a button does not protect the endpoint. Preserve internal
notes and credential-bearing notification/workflow data from unauthorized reads.

## Finish a change

Run focused tests and the required lint/type/build/codegen checks. Update the
matching handbook scenario and any runtime templates. A new backend variable
belongs in both backend development and infrastructure runtime templates. Add
Turbo outputs for any new cached task. Review the diff for accidental secrets,
generated build output and unrelated edits before handing off.
