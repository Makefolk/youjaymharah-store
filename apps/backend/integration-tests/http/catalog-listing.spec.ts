import { medusaIntegrationTestRunner } from "@medusajs/test-utils";
import { Modules } from "@medusajs/framework/utils";
import type { IApiKeyModuleService } from "@medusajs/framework/types";
import {
  createProductCategoriesWorkflow,
  createProductsWorkflow,
  linkSalesChannelsToApiKeyWorkflow,
} from "@medusajs/medusa/core-flows";
import { requireIsolatedDatabase } from "../helpers/isolated-database";

requireIsolatedDatabase();
jest.setTimeout(120_000);

medusaIntegrationTestRunner({
  inApp: true,
  dbName: "medusa-catalog-listing-integration",
  testSuite: ({ api, getContainer }) => {
    describe("GET /store/catalog", () => {
      let headers: Record<string, string>;
      let regionId: string;

      beforeAll(async () => {
        const container = getContainer();
        const channel = await container
          .resolve(Modules.SALES_CHANNEL)
          .createSalesChannels({ name: "Catalog test channel" });
        const otherChannel = await container
          .resolve(Modules.SALES_CHANNEL)
          .createSalesChannels({ name: "Other channel" });
        const region = await container.resolve(Modules.REGION).createRegions({
          name: "Catalog test region",
          currency_code: "ngn",
          countries: ["ng"],
        });
        regionId = region.id;

        const { result: categories } = await createProductCategoriesWorkflow(
          container,
        ).run({
          input: {
            product_categories: [
              { name: "Women", handle: "women", is_active: true },
            ],
          },
        });
        const { result: dresses } = await createProductCategoriesWorkflow(
          container,
        ).run({
          input: {
            product_categories: [
              {
                name: "Dresses",
                handle: "women-dresses",
                is_active: true,
                parent_category_id: categories[0].id,
              },
            ],
          },
        });

        const product = (
          handle: string,
          colour: string,
          size: string,
          price: number,
          options: {
            soldOut?: boolean;
            channel?: string;
            category?: string;
          } = {},
        ) => ({
          title: handle,
          handle,
          status: "published" as const,
          material: "Linen",
          sales_channels: [{ id: options.channel ?? channel.id }],
          category_ids: [options.category ?? dresses[0].id],
          options: [
            { title: "Colour", values: [colour] },
            { title: "Size", values: [size] },
          ],
          variants: [
            {
              title: `${colour} / ${size}`,
              manage_inventory: Boolean(options.soldOut),
              allow_backorder: false,
              options: { Colour: colour, Size: size },
              prices: [{ currency_code: "ngn", amount: price }],
            },
          ],
        });

        await createProductsWorkflow(container).run({
          input: {
            products: [
              product("black-dress", "Black", "M", 30000),
              product("navy-dress", "Navy", "S", 20000),
              product("sold-out-dress", "Black", "S", 10000, { soldOut: true }),
              product("other-channel-dress", "Black", "M", 5000, {
                channel: otherChannel.id,
              }),
            ],
          },
        });

        const key = await container
          .resolve<IApiKeyModuleService>(Modules.API_KEY)
          .createApiKeys({
            title: "Catalog test",
            type: "publishable",
            created_by: "test",
          });
        await linkSalesChannelsToApiKeyWorkflow(container).run({
          input: { id: key.id, add: [channel.id] },
        });
        headers = { "x-publishable-api-key": key.token };
      });

      const get = (query: string) =>
        api.get(`/store/catalog?region_id=${regionId}&${query}`, { headers });

      it("lists a category and its subcategories in this channel only, buyable first", async () => {
        const { data } = await get("category=women");
        expect(data.count).toBe(3);
        expect(data.ids).toHaveLength(3);
        const handles = await handlesOf(data.ids);
        expect(handles.at(-1)).toBe("sold-out-dress");
        expect(handles).not.toContain("other-channel-dress");
        expect(data.facets.colour).toEqual([
          expect.objectContaining({ value: "Black", count: 2 }),
          expect.objectContaining({ value: "Navy", count: 1 }),
        ]);
        expect(data.facets.material).toEqual([{ value: "Linen", count: 3 }]);
      });

      it("filters and sorts by price", async () => {
        const { data } = await get(
          "category=women-dresses&colour=Black&colour=Navy&size=S&sort=price_desc",
        );
        expect(await handlesOf(data.ids)).toEqual([
          "navy-dress",
          "sold-out-dress",
        ]);
        // Unranked sizes fall back to alphabetical order.
        expect(data.facets.size).toEqual([
          expect.objectContaining({ value: "M", count: 1 }),
          expect.objectContaining({ value: "S", count: 2 }),
        ]);
      });

      it("pages and rejects bad input", async () => {
        const { data } = await get("category=women&limit=1&offset=1");
        expect(data).toMatchObject({ count: 3, offset: 1, limit: 1 });
        expect(data.ids).toHaveLength(1);

        await expect(
          api.get("/store/catalog?category=women", { headers }),
        ).rejects.toMatchObject({ response: { status: 400 } });
        await expect(get("category=nope")).rejects.toMatchObject({
          response: { status: 404 },
        });
      });

      async function handlesOf(ids: string[]) {
        const { data } = await api.get(
          `/store/products?${ids.map((id) => `id[]=${id}`).join("&")}&fields=id,handle&limit=50`,
          { headers },
        );
        const byId = new Map(
          data.products.map((p: { id: string; handle: string }) => [
            p.id,
            p.handle,
          ]),
        );
        return ids.map((id) => byId.get(id));
      }
    });
  },
});
