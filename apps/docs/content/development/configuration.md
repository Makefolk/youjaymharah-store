---
title: Configuration reference
---

# Configuration reference

**Audience:** developers and operators.

**Prerequisites:** the target environment
and authorized secret-store access. The committed templates and production
environment validator are the exact source of required variables. This page
groups their purpose; it deliberately contains no real values.

## Sources and timing

| Source                               | Used for                                                        |
| ------------------------------------ | --------------------------------------------------------------- |
| `apps/backend/.env.template`         | Local/test backend configuration                                |
| `infra/backend.env.template`         | Production backend runtime configuration                        |
| `infra/.env.template`                | Compose image tags, domains and infrastructure settings         |
| `apps/storefront/.env.template`      | Storefront server and build-time variables                      |
| `apps/docs/.env.template`            | Optional live branding and authenticated docs hosting           |
| GitHub Environment variables/secrets | CI deployment inputs, build configuration and restricted access |

`NEXT_PUBLIC_*` and storefront image-host configuration are compiled into the
frontend image. Changing a runtime environment variable does not replace those
compiled values. Backend secrets and the shared revalidation secret are runtime
configuration and must reach the correct containers.

## Backend services

| Group        | Examples/purpose                                                  | Verification                                                             |
| ------------ | ----------------------------------------------------------------- | ------------------------------------------------------------------------ |
| Database     | `DATABASE_URL`                                                    | Readiness and isolated migration/restore evidence                        |
| Redis        | `REDIS_URL`, prefixes                                             | Shared sessions/locks/cache, durable jobs and restart recovery           |
| HTTP/auth    | CORS origins, JWT/cookie secrets, storefront/admin URLs           | Correct origins, secure cookies, sign-in and recovery                    |
| Google       | Client ID/secret and callback URL                                 | Fresh browser-bound OAuth flow                                           |
| Payments     | Credo mode/keys, Paystack key, callback and webhook configuration | Test/live environment agreement and verified transaction amount/currency |
| Email        | Resend key/sender/webhook secret and delivery-encryption key      | Send/delivery/review and signature checks                                |
| Files        | S3-compatible bucket/region/endpoint/keys/file URL                | Product upload/read and private attachment access                        |
| Search       | Approved vocabulary/trending configuration                        | Search results and privacy behavior                                      |
| Revalidation | `STOREFRONT_REVALIDATE_SECRET` on backend and storefront          | Authorized admin change refresh; unauthorized request refused            |

Use long random secrets from the approved secret store. Do not reuse sample
template values. Preserve encryption-key recovery for retained email records;
rotating a key without a migration/recovery plan can make records unreadable.

## Storefront

Set the backend URL, the storefront publishable key, canonical base URL and
approved image origins. The publishable key identifies the channel; it is not
customer authentication. Sentry configuration is optional, but any enabled
monitoring must be checked for private-data redaction and intended sampling.

Liveness is `/api/health`; readiness is `/api/ready`, which checks the backend,
Nigeria region and catalog API with the configured publishable key. Pair it
with rendered-page and checkout validation to establish customer availability.
If catalog calls fail, inspect
configuration without dumping complete request headers or environment values.

## Change and verification procedure

Document a new variable in every applicable template, explain when it is needed
and whether it requires rebuilding or restarting, and add validation for unsafe
production values. Change one environment deliberately and verify its affected
journeys. Never print, commit or copy `.env`/production secret files into a
report. Consult the [deployment runbook](/reference/generated/deployment) for
the actual environment and workflow wiring.
