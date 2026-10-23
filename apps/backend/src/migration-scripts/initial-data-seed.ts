import { MedusaContainer } from "@medusajs/framework";
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils";
import {
  createApiKeysWorkflow,
  createRegionsWorkflow,
  createSalesChannelsWorkflow,
  createStockLocationsWorkflow,
  createStoresWorkflow,
  createTaxRegionsWorkflow,
  createUsersWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
  linkSalesChannelsToStockLocationWorkflow,
} from "@medusajs/medusa/core-flows";
import { seedSearchVocabularyWorkflow } from "../workflows/seed-search-vocabulary";

/**
 * Seeds the minimum a real store needs to boot: sales channel, publishable
 * API key, store record, Nigeria region with the store's payment providers,
 * tax region, one stock location, and the first admin (with Super Admin).
 *
 * Deliberately NOT seeded: demo products/categories, shipping options and
 * service zones. Those describe the merchant's actual catalog and courier
 * pricing and are configured in the dashboard. Branding and newsletter
 * settings are not seeded either -- their modules self-create from env on
 * first read.
 *
 * Idempotent: every block is skipped if its entity already exists, so this is
 * safe to run against a database that already has data.
 */
export default async function initial_data_seed({
  container,
}: {
  container: MedusaContainer;
}) {
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER);
  const link = container.resolve(ContainerRegistrationKeys.LINK);
  const query = container.resolve(ContainerRegistrationKeys.QUERY);

  const storeName = process.env.STORE_NAME ?? "Youjaymharah";

  logger.info("Seeding store data...");

  const { data: existingStores } = await query.graph({
    entity: "store",
    fields: ["id", "name"],
  });

  const {
    result: [defaultSalesChannel],
  } = await createSalesChannelsWorkflow(container).run({
    input: {
      salesChannelsData: [
        {
          name: "Default Sales Channel",
          description: `Created for ${storeName}`,
        },
      ],
    },
  });

  const {
    result: [publishableApiKey],
  } = await createApiKeysWorkflow(container).run({
    input: {
      api_keys: [
        {
          title: "Web Storefront",
          type: "publishable",
          created_by: "",
        },
      ],
    },
  });

  await linkSalesChannelsToApiKeyWorkflow(container).run({
    input: {
      id: publishableApiKey.id,
      add: [defaultSalesChannel.id],
    },
  });

  logger.info(`Publishable API key token: ${publishableApiKey.token}`);

  if (existingStores.length) {
    logger.info(
      `Store already exists ("${existingStores[0].name}"); keeping its currencies and default sales channel.`,
    );
  } else {
    await createStoresWorkflow(container).run({
      input: {
        stores: [
          {
            name: storeName,
            supported_currencies: [
              { currency_code: "ngn", is_default: true },
              { currency_code: "usd", is_default: false },
            ],
            default_sales_channel_id: defaultSalesChannel.id,
          },
        ],
      },
    });
  }

  logger.info("Seeding Nigeria region and tax region...");
  // The region is created without payment providers: during db:migrate the
  // payment module has not yet registered pp_credo/pp_paystack (its boot
  // loader upserts those rows on first app start), so passing them to the
  // region workflow would fail validation. They are linked directly below --
  // the link pivot does not require the provider rows to exist yet.
  const { result: regionResult } = await createRegionsWorkflow(container).run({
    input: {
      regions: [
        {
          name: "Nigeria",
          currency_code: "ngn",
          countries: ["ng"],
        },
      ],
    },
  });
  const region = regionResult[0];

  // The test provider takes no money, so it is only offered outside
  // production (and refused there regardless: api/payment-guard.ts).
  const providers = ["pp_credo_credo", "pp_paystack_paystack"];
  if (process.env.NODE_ENV !== "production") {
    providers.unshift("pp_system_default");
  }
  await link.create(
    providers.map((payment_provider_id) => ({
      [Modules.REGION]: { region_id: region.id },
      [Modules.PAYMENT]: { payment_provider_id },
    })),
  );

  await createTaxRegionsWorkflow(container).run({
    input: [
      {
        country_code: "ng",
        provider_id: "tp_system",
      },
    ],
  });
  logger.info(`Finished seeding region ${region.name}.`);

  logger.info("Seeding stock location...");
  const { result: stockLocationResult } = await createStockLocationsWorkflow(
    container,
  ).run({
    input: {
      locations: [
        {
          name: "Lagos Warehouse",
          address: {
            city: "Lagos",
            country_code: "NG",
            address_1: "",
          },
        },
      ],
    },
  });
  const stockLocation = stockLocationResult[0];

  // Manual fulfillment provider so shipping options can be created in the
  // dashboard without wiring a provider first. Shipping options themselves
  // are not seeded.
  await link.create({
    [Modules.STOCK_LOCATION]: {
      stock_location_id: stockLocation.id,
    },
    [Modules.FULFILLMENT]: {
      fulfillment_provider_id: "manual_manual",
    },
  });

  await linkSalesChannelsToStockLocationWorkflow(container).run({
    input: {
      id: stockLocation.id,
      add: [defaultSalesChannel.id],
    },
  });
  logger.info("Finished seeding stock location.");

  await seedAdminUser(container, logger);
  await seedSearchVocabularyWorkflow(container).run({ input: {} });
}

async function seedAdminUser(
  container: MedusaContainer,
  logger: { info: (msg: string) => void; warn: (msg: string) => void },
) {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    logger.warn(
      "ADMIN_EMAIL / ADMIN_PASSWORD not set; skipping admin user creation. Create one with `medusa user` and run scripts/attach-super-admin.ts.",
    );
    return;
  }

  const query = container.resolve(ContainerRegistrationKeys.QUERY);
  const { data: existingUsers } = await query.graph({
    entity: "user",
    fields: ["id", "email"],
    filters: { email },
  });

  if (existingUsers.length) {
    logger.info(`Admin user ${email} already exists; skipping.`);
    return;
  }

  // Mirrors `medusa user`: create the user with the Super Admin role, then
  // register the emailpass auth identity and link it to the user.
  const { result: users } = await createUsersWorkflow(container).run({
    input: {
      users: [
        {
          email,
          first_name: "Admin",
          roles: ["role_super_admin"],
        },
      ],
    },
  });
  const user = users[0];

  const authService = container.resolve(Modules.AUTH);
  const { authIdentity, error } = await authService.register("emailpass", {
    body: { email, password },
  });

  if (error) {
    logger.warn(
      `User ${email} was created with the Super Admin role, but registering its password failed: ${error}. Set a password via the admin login flow.`,
    );
    return;
  }

  await authService.updateAuthIdentities({
    id: authIdentity!.id,
    app_metadata: {
      user_id: user.id,
    },
  });

  logger.info(`Admin user ${email} created with the Super Admin role.`);
}
