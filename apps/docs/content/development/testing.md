---
title: Testing and release evidence
---

# Testing and release evidence

**Audience:** developers and release operators.

**Prerequisites:** an isolated
test environment, fake/sandbox providers and a precise behavior to verify.
Choose tests that establish outcomes and safety boundaries, not copies of the
implementation.

## Verification layers

| Layer                          | What it establishes                                                    | What it does not establish                                     |
| ------------------------------ | ---------------------------------------------------------------------- | -------------------------------------------------------------- |
| Unit tests                     | Validation, access decisions, calculations and state transitions       | Real framework routing, database behavior or provider delivery |
| HTTP/database integration      | Middleware, workflow/database effects, permissions and replay behavior | Actual gateway/email acceptance when HTTP is mocked            |
| Migration checks               | Fresh schema and repeat-run behavior                                   | Compatibility with every historical production dataset         |
| Production builds              | Compiled app/admin/docs and framework type checks                      | Hosted credentials, DNS or live customer success               |
| Browser journeys               | UI, cookies, redirects, navigation and visible error states            | Durable restart recovery unless the test exercises it          |
| Redis/restart tests            | Durable jobs, multi-worker coordination and replay                     | Off-host restore unless separately rehearsed                   |
| Controlled provider acceptance | Real integration configuration and expected provider outcomes          | Every future outage or settlement edge case                    |

## Security and payment regressions

Cover direct API authorization, wrong-owner access, expired guest proof,
internal-note privacy, private-file access, password-reset session invalidation,
OAuth callback state and abuse limits. Verify native endpoints cannot bypass a
custom safety boundary.

For payments, test amount/currency mismatch, duplicate and reordered webhooks,
concurrent final-stock purchases, callback interruption, delayed success,
already-completed carts and manual/test-provider rejection in production mode.
For refunds, test duplicate references, pending provider status, wrong original
transaction and local recording ambiguity after external completion.

## Build and contract checks

Run backend build, storefront lint/type checks/tests, production storefront
build against a controlled API, and docs lint/build. Backend codegen must pass
its freshness check. The docs build imports the generated contract; it does not
make a stale contract accurate.

The docs build validates internal links. Its reference sync imports only named
repository runbooks and API JSON, never real environment files. Verify search,
deep links and authentication when hosting it.

## Record evidence

Record the revision, environment, test command, relevant result and material
limitations. A prior green run does not cover subsequent edits. Avoid claiming
live-provider or production recovery coverage from mocks or an in-memory bus.

When a test fails, establish whether it is an implementation defect, fixture
problem or unavailable dependency. Do not disable a Medusa lint rule, weaken an
authorization check or change a financial expectation just to obtain a pass.
Keep release acceptance tied to the [launch checklist](/operations/launch).
