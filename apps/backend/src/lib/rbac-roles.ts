import type { MedusaContainer } from "@medusajs/framework/types";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";

/**
 * Provisions the store's RBAC roles.
 *
 * Called from two places so it covers both cases:
 *   - `src/migration-scripts/` so `medusa db:migrate` provisions roles on a
 *     fresh environment without anyone remembering to.
 *   - `src/scripts/` so `medusa exec` can re-run it on demand. That matters
 *     because a migration script only ever runs once: adding a module with new
 *     policies later needs a re-run to grant them, which is exactly what
 *     happened when `newsletter` was added after the roles already existed.
 *
 * Idempotent: it creates a role only when the id is absent, and attaches only
 * policies the role does not already hold. Editing a role in the dashboard is
 * therefore safe -- rerunning this will not strip policies a human removed,
 * though it will re-add any listed here that are missing.
 *
 * Super Admin is not defined here; core seeds `role_super_admin` with `*:*`.
 */

const READ = "read";
const WRITE = ["read", "create", "update"] as const;
const FULL = ["read", "create", "update", "delete"] as const;

const CATALOG = [
  "product",
  "product_variant",
  "product_option",
  "product_option_value",
  "product_tag",
  "product_type",
  "product_category",
  "product_collection",
  // Custom (src/policies/size-guide.ts). Existing environments need
  // `medusa exec ./src/scripts/seed-rbac-roles.ts` to pick it up.
  "size_guide",
];
const PRICING = ["price", "price_list", "price_preference", "currency"];
const INVENTORY = [
  "inventory_item",
  "inventory_level",
  "reservation_item",
  "stock_location",
];
const ORDERS = [
  "order",
  "order_item",
  "order_change",
  "order_claim",
  "order_claim_item",
  "order_exchange",
  "return",
  "return_reason",
];
const PAYMENTS = [
  "payment",
  "payment_collection",
  "payment_method",
  "payment_session",
  "refund_reason",
];
const CUSTOMERS = ["customer", "customer_address", "customer_group"];
const PROMOTIONS = ["campaign", "promotion"];
const SHIPPING = [
  "shipping_option",
  "shipping_option_type",
  "shipping_profile",
  "fulfillment",
  "fulfillment_provider",
  "fulfillment_set",
  "service_zone",
];
const TAX = ["tax_provider", "tax_rate", "tax_region"];
const REGIONS = ["region", "sales_channel"];
const FILES = ["file", "notification", "workflow_execution"];

type PolicyGrant = { resources: string[]; operations: readonly string[] };

type RoleDefinition = {
  id: string;
  name: string;
  description: string;
  grants: PolicyGrant[];
};

const ROLES: RoleDefinition[] = [
  {
    id: "role_store_manager",
    name: "Store Manager",
    description:
      "Day-to-day operations: catalog, inventory, orders, customers, discounts. No user management, API keys or store branding.",
    grants: [
      { resources: CATALOG, operations: FULL },
      { resources: PRICING, operations: FULL },
      { resources: INVENTORY, operations: FULL },
      { resources: ORDERS, operations: FULL },
      { resources: PAYMENTS, operations: WRITE },
      { resources: CUSTOMERS, operations: FULL },
      { resources: PROMOTIONS, operations: FULL },
      { resources: SHIPPING, operations: FULL },
      { resources: TAX, operations: FULL },
      { resources: REGIONS, operations: FULL },
      { resources: FILES, operations: WRITE },
      { resources: ["storefront_settings"], operations: [READ, "update"] },
      // Custom (src/policies/cart-reminder.ts).
      { resources: ["cart_reminder"], operations: [READ, "update"] },
      // Custom (src/policies/return-policy.ts).
      { resources: ["return_policy"], operations: [READ, "update"] },
      // Sees the Brand section of Settings -> Storefront; changing it stays
      // with the owner.
      { resources: ["branding"], operations: [READ] },
      // Read-only on the store record: they can see currencies and defaults
      // but changing store identity stays with the owner.
      { resources: ["store", "store_locale"], operations: [READ] },
    ],
  },
  {
    id: "role_support",
    name: "Support / Fulfillment",
    description:
      "Orders and customers only: view orders, move fulfillment along, issue refunds. Read-only on the catalog, no settings.",
    grants: [
      { resources: ORDERS, operations: WRITE },
      { resources: ["customer", "customer_address"], operations: WRITE },
      {
        resources: [
          "fulfillment",
          "fulfillment_set",
          "shipping_option",
          "service_zone",
        ],
        operations: WRITE,
      },
      // Refunds run through the payment resources -- there is no way to grant
      // "can refund" without also granting sight of payment records.
      { resources: PAYMENTS, operations: WRITE },
      // Needed to render order lines; deliberately read-only so support can
      // never touch pricing or the catalog.
      { resources: CATALOG, operations: [READ] },
      { resources: ["region", "sales_channel"], operations: [READ] },
      {
        resources: [
          "storefront_settings",
          "branding",
          "cart_reminder",
          // To quote the return window to customers.
          "return_policy",
        ],
        operations: [READ],
      },
    ],
  },
  {
    id: "role_marketing",
    name: "Marketing",
    description:
      "Campaigns, discounts and collections. Read-only on the catalog, no access to orders, payments or customer records.",
    grants: [
      { resources: CATALOG, operations: [READ] },
      {
        resources: ["product_collection", "product_category"],
        operations: WRITE,
      },
      { resources: PROMOTIONS, operations: FULL },
      { resources: ["price_list", "price"], operations: WRITE },
      // Campaign targeting needs groups, but not the customer records
      // themselves -- no `customer` grant, so no emails or order history.
      { resources: ["customer_group"], operations: [READ] },
      // Newsletter settings and the subscriber list.
      { resources: ["newsletter"], operations: [READ, "update"] },
      // Search & sharing (titles, share image, social links, indexing) and
      // product display settings such as how long products count as new.
      { resources: ["storefront_settings"], operations: [READ, "update"] },
      // Abandoned cart reminder emails.
      { resources: ["cart_reminder"], operations: [READ, "update"] },
      // Sees the Brand section; changing it stays with the owner.
      { resources: ["branding"], operations: [READ] },
      { resources: ["file"], operations: WRITE },
    ],
  },
];

function policyKeys(definition: RoleDefinition): string[] {
  const keys = new Set<string>();

  for (const grant of definition.grants) {
    for (const resource of grant.resources) {
      for (const operation of grant.operations) {
        keys.add(`${resource}:${operation}`);
      }
    }
  }

  return [...keys];
}

export async function provisionRbacRoles(container: MedusaContainer) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const rbac = container.resolve(Modules.RBAC) as any;

  for (const definition of ROLES) {
    const [existing] = await rbac.listRbacRoles({ id: definition.id });

    if (!existing) {
      await rbac.createRbacRoles([
        {
          id: definition.id,
          name: definition.name,
          description: definition.description,
        },
      ]);
      logger.info(`RBAC: created role "${definition.name}".`);
    }

    const wanted = policyKeys(definition);
    const policies = await rbac.listRbacPolicies({ key: wanted });
    const found = new Map<string, string>(
      policies.map((p: { key: string; id: string }) => [p.key, p.id]),
    );

    const missing = wanted.filter((key) => !found.has(key));
    if (missing.length) {
      // A resource that no longer exists in this Medusa version, or a custom
      // module whose policies have not been registered yet.
      logger.warn(
        `RBAC: ${definition.name} references unknown policies, skipped: ${missing.join(", ")}`,
      );
    }

    const held = await rbac.listPoliciesForRole(definition.id);
    const heldIds = new Set(held.map((p: { id: string }) => p.id));

    const toAttach = [...found.values()]
      .filter((policyId) => !heldIds.has(policyId))
      .map((policyId) => ({ role_id: definition.id, policy_id: policyId }));

    if (toAttach.length) {
      await rbac.createRbacRolePolicies(toAttach);
      logger.info(
        `RBAC: attached ${toAttach.length} policies to "${definition.name}".`,
      );
    }
  }

  logger.info("RBAC: role provisioning complete.");
}
