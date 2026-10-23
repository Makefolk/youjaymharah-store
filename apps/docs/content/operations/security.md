---
title: Security and private data
---

# Security and private data

**Audience:** owner, operators, support and developers.

**Prerequisites:**
authorized access and an incident escalation path. Do not investigate customer
data beyond what the assigned task requires.

## Access and credential recovery

Use individual staff accounts, least privilege and the deployed MFA/access
policy. Native MFA capability alone is not proof that enforcement, enrollment
and recovery are configured. Verify both API and dashboard access, including
older sessions after a role or credential change.

For suspected compromise, contain the affected identity, end active credentials,
perform verified recovery and inspect relevant access evidence. Check gateway,
email, infrastructure and docs access separately. Rotate a secret only with an
understanding of the dependent services, signed links and retained encrypted
records; an unplanned global rotation can make recovery harder.

## Customer information

Orders require owning-account or valid guest proof. A display order number,
email address or screenshot is not sufficient authority to disclose details or
change delivery instructions. Support conversations can include sensitive
photos; authorized thread access must extend to their file downloads.

Guest links should expire and support reissue/revocation. Avoid putting them in
logs, analytics, referrers or shared tickets. New private uploads do not change
the accessibility of old public objects. Migrate or delete those objects under
an approved plan and verify the original URLs no longer expose them.

## Data access and deletion requests

Verify the requester through an appropriate account/inbox flow. Identify the
customer's order, support, marketing and file records and the applicable
business retention requirements. Use an approved export/deletion process;
never delete financial/order records ad hoc to satisfy a request quickly.
Apply the decision to derived exports and provider-held data as appropriate,
then record completion without retaining unnecessary copies.

## Infrastructure and application checks

- Keep application/database/Redis ports private and validate the trusted proxy
  chain so client-IP rate limits cannot be bypassed through a direct origin.
- Verify HTTPS, CORS, cookie settings and browser headers on the deployed host.
- Reject manual/test payments at the production API boundary.
- Keep request-size/time limits and signed webhook verification enabled.
- Review dependency advisories and update through the package manager with
  regression checks. An advisory count alone is not a demonstrated exploit.
- Test monitoring redaction using fake credentials/tokens; inspect what is
  actually sent, not just the configuration flag.

## Verification and incident evidence

Test forbidden reads, expired links, repeated callbacks, wrong webhook
signatures, rate limits and credential revocation in isolated data. Preserve
timestamps, affected revision and sanitized identifiers during an incident.
Escalate any possible exposure to the owner and follow the business's incident
and notification process. See [monitoring](/operations/incidents) and
[roles](/staff/roles) for ownership and containment.
