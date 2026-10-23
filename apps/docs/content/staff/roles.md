---
title: Roles and responsibilities
---

# Roles and responsibilities

**Audience:** owner and team leads.

**Prerequisites:** an authorized Super Admin
for invitations and role administration. Every staff member needs an individual
account; shared accounts make responsibility and recovery unclear.

| Role                  | Typical responsibilities                                                               | Boundaries                                                                                  |
| --------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Super Admin           | Staff access, API keys, identity/settings, sensitive diagnostics and incident recovery | Keep membership small and protect the account with the deployed second-factor/access policy |
| Store Manager         | Catalog, inventory, pricing, orders, customers, promotions, delivery and taxes         | Does not administer users, API keys or all brand settings                                   |
| Support / Fulfillment | Customer conversations, order help, fulfillment, returns and authorized refunds        | Does not change product pricing or global store settings                                    |
| Marketing             | Campaigns, permitted collections/content, newsletter and search settings               | Does not need access to order/payment/customer records outside its granted scope            |

The deployed permission matrix is authoritative. A visible menu is not a
security boundary, and a missing menu is not proof that the API is restricted.
Sensitive workflow diagnostics are restricted to the current Super Admin role.

## Join, change role or leave

1. The owner confirms the person's work and chooses the least privilege that
   supports it. Use the admin invitation flow; the recipient sets their own
   credential.
2. Verify the invitation reaches the intended person and that their account
   can perform one permitted task and is refused one forbidden task.
3. For a role change, verify both the UI and API behavior after a fresh sign-in.
4. For departure or compromise, remove access through the supported admin
   process, end active credentials and review access to gateway, email,
   infrastructure and docs systems separately.

Do not email passwords or place invitation/reset links in tickets or this
handbook. Expired invitations need a supported reissue. Staff unable to inspect
workflow diagnostics should escalate to the owner rather than receive a broad
role simply for troubleshooting.

## Escalation and verification

Payment mismatches, duplicate refunds, suspected account access and irreversible
order actions go to the owner. A shift lead assigns coverage for support and
settlement checks. Verify that staff cannot retrieve email credential payloads,
see internal data outside their role or continue using a revoked credential.
