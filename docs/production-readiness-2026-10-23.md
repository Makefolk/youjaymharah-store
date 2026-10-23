**Production readiness review — October 23, 2026**

This is the original assessment snapshot. Subsequent implementation work has
addressed several findings; see the [implementation follow-up](#implementation-follow-up)
before treating an item below as still missing.

The core Nigeria/NGN store is implemented. I would hold public launch until the
payment-provider configuration, customer-data access, production setup and
end-to-end release checks below are complete. A small launch can use manual
fulfillment, gateway-dashboard refunds and staff-assisted exchanges; those do
not require another large feature build.

This review covers the storefront, custom admin screens, backend workflows and
APIs, payments, support, CI and infrastructure. It reflects the working tree
based on `224c3fb`, including the preceding local security fixes. Hosted
configuration, production data, DNS, gateway accounts and backup settings were
not inspected. A configuration risk below is not a claim that production has
that setting. Application code was not changed during this assessment.

The following capabilities already have implementations. Older planning
documents understate how much is built.

| Area                    | Present in the code                                                                                                                                | What still needs proving or completing                                                |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Catalog                 | Categories, collections, search and filters, variants, galleries, size guides, quick view and stock states                                         | Real catalog, prices, images, inventory and search acceptance checks                  |
| Shopping                | Guest/account bags, promotions, addresses, delivery selection, Paystack and Credo redirects                                                        | Configured delivery coverage and payment failure/recovery journeys                    |
| Accounts                | Password and Google sign-in, verification, reset, profile, addresses, preferences and order history                                                | Live identity-provider setup, session revocation and privileged-access controls       |
| After purchase          | Order status, tracking links, partial shipments, return eligibility/request/status                                                                 | Private order access and operational return/refund rehearsal                          |
| Support                 | Contact and order-help forms, photos, customer threads, account support list, staff inbox, assignment, priority, internal notes and replies        | Private files, revocable guest links and support operating procedures                 |
| Retention and marketing | Wishlists, newsletter consent/confirmation/unsubscribe, checkout opt-in, bag reminders, restock/launch alerts                                      | Sender setup, consent copy, scheduled-job validation and business configuration       |
| Admin                   | Native catalog/orders/stock/promotions, custom payment lookup, attention panel, email history/review, CMS, return/support settings and staff roles | Staff training, recovery procedures and role verification in the deployed environment |
| Infrastructure          | Container definitions, server/worker split, Redis persistence, backend readiness, CI, deployment rollback and uptime workflow                      | Hosted configuration, frontend readiness, restore drills and worker monitoring        |

The launch work below is ordered by consequence. **P0** means complete before
accepting real customer orders or private uploads. **P1** means complete before
broad or unattended operation; where stated, an explicit staffed procedure can
cover an initial small launch.

1. **P0 — Prevent manual/test payments in production. Code and configuration.**

   The [initial seed](../apps/backend/src/migration-scripts/initial-data-seed.ts)
   links `pp_system_default` to the Nigeria region alongside the two gateways.
   The [storefront filter](../apps/storefront/lib/medusa/checkout.ts) hides it
   outside development, but no project middleware rejects its use through the
   public payment-session API. The installed Medusa system provider authorizes
   payments without collecting money. If that provider remains enabled in a
   production region, hiding it in the checkout does not prevent unpaid orders.

   Remove it from production regions, make the seed environment-aware, and add
   a server-side production guard. The handbook already tells staff to remove
   Manual Payment; enforce that instruction in code as well. Completion means
   a direct Store API attempt is rejected and both real gateway paths still
   work. Production's current region configuration remains unverified.

2. **P0 — Restrict order details and support attachments. Code.**

   [Order retrieval](../apps/storefront/features/orders/server.ts) deliberately
   uses the order ID without authentication. The installed backend route also
   permits this. The [order page](<../apps/storefront/app/(main)/orders/[id]/page.tsx>)
   exposes delivery details to anyone holding that URL. These are opaque IDs,
   not sequential order numbers, but they are permanent bearer credentials.

   [Support uploads](../apps/backend/src/workflows/steps/support.ts) explicitly
   create public files. Ticket authorization therefore does not protect the
   photo itself once its URL is known. [Guest support access](../apps/backend/src/lib/support.ts)
   has no expiry or per-ticket revocation. These links are unguessable; the
   concern is continued access after forwarding, leakage or account recovery.

   Require account ownership or expiring guest proof for sensitive order
   reads, including the backend route. Move support photos to private storage
   with authorized, short-lived downloads. Store file IDs for deletion, and
   add guest-link expiry, reissue and revocation. Preserve fresh-checkout and
   email-link journeys when adding these controls. Existing public objects
   would need a migration/access-policy decision, not just different settings
   on new uploads.

3. **P0 — Establish a working release and complete purchase rehearsal. Validation.**

   In the local HTTP check, `/api/health` returned 200 while `/`, `/products`,
   `/shopping-bag`, `/checkout`, `/contact`, `/help/returns`, `/privacy`, `/terms`
   and `/account/sign-in` returned 500. Nothing answered on localhost port 9000.
   This is a local environment result, not evidence of a production outage;
   the page-error cause was not established. It means the current local server
   cannot substantiate a successful shopper journey.

   The [storefront health route](../apps/storefront/app/api/health/route.ts)
   intentionally checks liveness only. Keep that lightweight check, but add a
   separate readiness/synthetic check that exercises a rendered page and a
   usable catalog/API path. A passing health endpoint must not be the only
   storefront release gate.

   Build the storefront production image against a controlled backend and run
   browser journeys on desktop and mobile. Cover successful, canceled and
   delayed payments; lost cookies/network; duplicate callbacks/webhooks; final
   stock competition; discounts and tax; fulfillment, returns and refunds;
   account recovery; and a customer/staff support exchange. Use gateway test
   modes and isolated data before a controlled live acceptance check.

4. **P0 — Configure the actual business and release the existing fixes. Configuration.**

   The seed intentionally creates no products or shipping options and leaves
   the stock-location street address empty. Populate and verify the real
   catalog, stock locations, inventory, tax treatment, service zones, shipping
   rates, supported states and return reasons. A shopper needs at least one
   valid delivery option for each supported address.

   Verify production gateway modes/keys/callbacks/webhooks, Google origins and
   callbacks, publishable-key sales-channel scope, object storage and image
   host allowlists, email sender/domain/webhook setup, HTTPS/CORS and secrets.
   Complete support contacts, delivery/return information, privacy/terms pages
   and business-approved consent text. Empty CMS policy pages are not a
   completed policy implementation.

   Release the [preceding security changes](security-remediation-2026-10-22.md)
   and their new refund-ledger migration. Reconcile historical uncertain
   refunds before rollout. Local changes and a passing disposable migration
   test do not establish that the hosted application has these protections.

5. **P1 — Make payment recovery durable and the callback honest. Code and operations.**

   Webhooks, verification and manual payment lookup exist. However, the
   [attention panel](../apps/backend/src/api/admin/attention.ts) examines only
   a three-day window, fetches at most 200 recent sessions, and checks the first
   15 candidates with the gateways. It also keeps only the newest attempt per
   cart. Older or superseded paid attempts can be missed. There is no scheduled
   payment-reconciliation job with persistent progress.

   Add a durable reconciliation queue/cursor, per-attempt next-check times,
   bounded retries, escalation and an operator resolution trail. Reconcile
   every relevant payment reference, including older attempts for one cart.
   Completion means delayed or missed events are recovered after a worker
   restart and cannot remain hidden behind newer abandoned attempts. Until
   then, a small launch needs an assigned operator comparing gateway
   settlements with orders, beyond just reading the attention panel.

   The [callback](<../apps/storefront/app/(main)/checkout/callback/complete-payment.tsx>)
   attempts completion once. Its generic error branch says no order was
   placed, although a timeout can leave the outcome unknown. Add an explicit
   pending/unknown state, safe status retries and recovery when the cart cookie
   is missing. Never invite a repeat payment solely because a response failed.

6. **P1 — Complete account recovery and privileged-access controls. Code and configuration.**

   [Logout](../apps/storefront/app/api/auth/logout/route.ts) clears browser
   cookies; it does not invalidate copied tokens. Password recovery does not
   revoke every previously issued session. Add server-enforced revocation or
   a credential/session version checked on protected requests, and test an old
   token after password reset and account recovery.

   Admin MFA enforcement is not configured in this project. Establish a
   supported second-factor/access-control path for staff and owner accounts,
   including recovery and offboarding. Verify deployed role permissions, not
   just hidden menu items. The storefront currently rejects authentication
   responses requiring extra steps with a generic error, so enabling such a
   requirement also needs the corresponding customer flow.

7. **P0 minimum / P1 automation — Prove recovery and detect stopped work. Operations.**

   Backend readiness checks database and Redis access. Redis AOF persistence,
   retries and email review are useful existing protections. The deployment
   still has one VPS and one Redis volume; these do not establish off-host
   recovery or that workers are processing jobs.

   Verify database restore coverage, object-storage recovery and Redis/job-state
   recovery, define acceptable data loss and outage time, and restore into an
   isolated environment. Reconcile payment/email side effects before replaying
   recovered work. Assign an alert recipient and incident owner before launch.

   Add worker heartbeats, oldest-job/backlog and failed-work alerts, overdue
   payment/email alerts, Redis memory/disk alerts and external storefront/API
   checks. Exercise retries with Redis and multiple workers, including a worker
   restart mid-job. Test VPS resource limits under representative load. The
   [operations document](production-operations.md) records unresolved hosted
   setup; this review did not verify those accounts. Its approved log-retention
   periods also need actual enforcement and verification.

8. **P1 — Strengthen deployment gates and rollback. CI and infrastructure.**

   [CI](../.github/workflows/ci.yml) does not build the storefront production
   image. [Deployment](../.github/workflows/deploy.yml) changes the backend
   before building the storefront against it. A frontend build failure can
   therefore leave a new backend serving an old storefront. Add a staging
   build/acceptance gate and explicit compatibility and whole-release rollback
   procedures. Make API-codegen freshness a required release check as well.

   [Deployment migrations](../infra/deploy.sh) run while old application and
   worker processes remain active. Keep migrations backward compatible and
   implement the drain/pause procedure needed when persisted workflow graphs
   change. Test rollback with real migration history; restarting an older image
   does not undo schema changes. The email reliability runbook already
   identifies this workflow-transition concern.

9. **P1 — Finish cache invalidation and shipping error handling. Code.**

   The backend [notifies `/api/revalidate`](../apps/backend/src/workflows/steps/notify-storefront.ts),
   but the storefront has no such route. Products currently use a 60-second
   cache; taxonomy, settings and content pages use 300 seconds. Implement a
   secret-validated endpoint with an allowed tag set, wire the deployment
   secret, and verify an admin edit becomes visible. Current time-based
   revalidation provides a fallback, so this is not a missing catalog feature.

   [Delivery selection](<../apps/storefront/app/(main)/checkout/checkout-flow.tsx>)
   displays `option.amount` and defaults a missing amount to zero. There is no
   calculated-shipping quote flow. Use verified flat rates for launch, or add
   the quote workflow before enabling a calculated provider. Also distinguish
   a shipping-service failure from a genuinely unsupported address; both
   currently show the same cannot-deliver message.

10. **P1 — Resolve the current dependency findings and finish browser hardening. Code.**

    A fresh production audit on October 23 reports **0 critical, 2 high, 0
    moderate** advisories. This supersedes the dependency counts in the October
    22 remediation report. The current findings are:

    - `@graphql-tools/utils` 12.0.1: the reviewed
      [prototype-pollution advisory](https://github.com/advisories/GHSA-c4qx-w738-7hr3)
      identifies 12.0.2 as fixed. The npm registry confirms 12.0.2 is published.
      Update the existing workspace override through pnpm and validate Medusa
      build, query behavior and API tests.
    - `braces` 3.0.3: the reviewed
      [stack-exhaustion advisory](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
      lists no patched release. Although the audit suggests 3.0.4, that version
      returns 404 from the npm registry. Track the fix and assess runtime
      reachability rather than suppressing the finding or inventing a version.

    An attacker-controlled path to either affected function was not established
    in this assessment. Package advisory severity alone does not demonstrate
    exploitation of the store.

    Caddy sets HSTS and nosniff; the admin also denies framing. A storefront CSP
    and frame-ancestor restriction remain to implement and test with payment,
    image and authentication flows. Verify direct-origin protection and trusted
    client-IP forwarding in the deployed network. Test error-monitoring
    redaction of cookies, tokens and sensitive payloads; disabling default PII
    collection alone is not evidence of every event's contents.

11. **P1 — Complete support and data-handling procedures. Code and operations.**

    Support requests for cancellation, address changes, exchanges, damage and
    missing items create conversations; they do not automatically perform the
    order action. Staff can handle these through existing admin capabilities.
    Document ownership, response targets, refund authority, escalation and
    evidence handling. Rehearse one full customer/staff conversation and a
    request that must become an actual order change.

    Paystack refunds are dashboard-first, then verified and recorded in Medusa.
    Credo uses a dashboard-first staff record and cannot independently verify
    refund completion through the current integration. The refund ledger
    prevents duplicate references, but ambiguous local recording failures still
    need operator reconciliation. An operator recovery screen and automatic
    refund-event reconciliation would reduce this manual burden.

    Implement retention/deletion for support photos and messages, plus a clear
    process for customer data-access/deletion requests and retained order
    records. Server-side image decoding/re-encoding and metadata stripping are
    still useful: the current API checks size and byte signatures, while the
    browser performs the image re-encoding. Direct API callers bypass that
    browser processing.

Features that can follow a controlled launch include self-service exchanges and
claims, automatic courier quotes/labels/tracking updates, support SLA escalation
and canned replies, live thread refresh or inbound-email reply synchronization,
refund recovery automation, product reviews, loyalty, gift cards/store credit,
POS, and international/multi-currency shopping. The current checkout is designed
for Nigeria and NGN. Conversion-funnel analytics also remain to be connected,
with the appropriate business consent and retention choices. These features
become launch requirements only if they are part of the advertised offering.

Some documentation needs reconciliation with the code: planning checklists
still describe implemented features as unfinished, and the manager handbook
still says customer tracking links are unavailable. Its refund instructions
already describe the new dashboard-first flow. Use tested behavior as the
source of truth when updating staff guidance.

Validation from the preceding remediation pass is recorded in the
[security report](security-remediation-2026-10-22.md): 240 backend unit tests,
169 storefront tests and 77 HTTP/database integration tests passed; backend/admin
build, disposable PostgreSQL migrations, API-contract freshness and relevant
lint/type checks passed. Gateway/email calls were mocked and integration tests
used local event-bus/locking implementations. Those results were not rerun for
this documentation-only review. This review additionally refreshed the
production dependency audit, checked published fixes and performed the local
HTTP smoke check described above. Browser end-to-end, frontend production-image,
live gateway/Google/email and Redis restart/concurrency validation remain open.

The practical implementation sequence is: payment guard and private access;
available dependency fix and session recovery; payment reconciliation and
callback recovery; storefront readiness/cache/shipping refinements; then a
configured staging rehearsal covering purchase through fulfillment, return and
refund, with monitoring and an isolated restore test. A release is ready when
those results are recorded against the exact revision and the staff procedures
have named owners.

## Implementation follow-up

The internal handbook now lives in `apps/docs`: 28 maintained guides, a
56-scenario index, seven imported operational runbooks and the generated custom
API reference. It covers customer journeys, staff operations, exceptions,
security, deployment, recovery and development. Known manual or unavailable
features are called out in the scenario index. It is not a claim that every
future incident has been anticipated.

The docs use the storefront's light/dark brand tokens, and the header and
favicon read admin-managed branding through the public Store API. Guides remain
usable when branding is unavailable. The production container requires
authentication for every file, including search indexes and API downloads.
Local development and preview bind to loopback. CI builds and checks the docs;
no public hosting has been deployed.

The storefront now has `/api/ready`, which checks backend health, the Nigeria
region and a catalog response using its publishable key. Deployment checks this
alongside liveness. Configure `STOREFRONT_HEALTH_URL` to use `/api/ready` for
external monitoring, and retain a rendered-page/checkout acceptance check.

The published `@graphql-tools/utils` fix is installed. Current published fixes
for the docs development server and YAML, IP-address and test-tool dependencies
are also applied through pnpm. The `braces` advisory remains tracked; a clean
audit is not claimed while the patched version is unavailable.

Validation for this follow-up: 253 backend unit tests, 187 storefront tests and
six branding-proxy checks pass. Backend/admin build, storefront type-check and
readiness-route lint pass. Docs lint, static build and container build pass.
Browser checks cover light/dark themes, mobile layout, search, separated guide
metadata, live admin branding and the backend-unavailable fallback. Container
checks confirm unauthenticated requests are refused for pages, search assets,
API reference and branding, and docs credentials are not forwarded upstream.
The final complete dependency audit reports 0 critical, 1 high, 0 moderate and
0 low findings; the one remaining finding is `braces`. These checks do not
exercise real payments, hosted configuration or restart recovery.

Concurrent application work has also added payment-provider guarding, session
revocation, persistent payment reconciliation, private/expiring customer access,
worker monitoring and cache revalidation. Those areas remain owned by that
work. This follow-up does not substitute for its acceptance evidence or a review
of live configuration and existing records.

The remaining launch gate is a configured staging rehearsal: real rendered
storefront pages, gateway and email callbacks, identity recovery, staff
fulfillment/refunds/support, Redis restart/retry behavior, an isolated restore
and delivery of operational alerts. Existing public files and old credentials
need their documented migration/recovery decisions. Courier integration,
automated refunds and the additional commercial features listed above remain
separate feature work where they are part of the intended offering.
