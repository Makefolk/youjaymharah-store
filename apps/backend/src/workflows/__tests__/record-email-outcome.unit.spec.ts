import type { MedusaContainer } from "@medusajs/framework/types";
import type { StepResponse } from "@medusajs/framework/workflows-sdk";
import { recordEmailOutcomeStep } from "../steps/record-email-outcome";

jest.mock("@medusajs/framework/workflows-sdk", () => ({
  ...jest.requireActual("@medusajs/framework/workflows-sdk"),
  createStep: jest.fn((_config, handler) => handler),
}));

function setup(row?: Record<string, unknown>) {
  const rows = new Map<string, any>(row ? [[row.id as string, row]] : []);
  const service = {
    listEmailDeliveries: jest.fn(async (filters: Record<string, string>) =>
      [...rows.values()].filter((candidate) =>
        Object.entries(filters).every(
          ([key, value]) => candidate[key] === value,
        ),
      ),
    ),
    updateEmailDeliveries: jest.fn(async (data) => {
      rows.set(data.id, { ...rows.get(data.id), ...data });
    }),
  };
  const services: Record<string, unknown> = {
    emailDelivery: service,
    locking: { execute: (_key: string, job: () => unknown) => job() },
  };
  const container = {
    resolve: (key: string) => services[key],
  } as unknown as MedusaContainer;
  const run = async (input: unknown, attempt = 1) =>
    (
      await (
        recordEmailOutcomeStep as unknown as (
          input: unknown,
          context: unknown,
        ) => Promise<StepResponse<{ recorded: boolean }>>
      )(input, { container, attempt })
    ).output;
  return { run, rows, service };
}

const outcome = (name: string, at: string) => ({
  provider_id: "re_1",
  outcome: name,
  occurred_at: at,
  detail: null,
});

it("records the outcome on the delivery with that receipt", async () => {
  const { run, rows } = setup({ id: "emdel_1", provider_id: "re_1" });
  expect(await run(outcome("delivered", "2026-10-21T10:00:00.000Z"))).toEqual({
    recorded: true,
  });
  expect(rows.get("emdel_1")).toMatchObject({
    outcome: "delivered",
    outcome_at: new Date("2026-10-21T10:00:00.000Z"),
  });
});

it("keeps the newer outcome when events arrive out of order", async () => {
  const { run, rows } = setup({
    id: "emdel_1",
    provider_id: "re_1",
    outcome: "bounced",
    outcome_at: new Date("2026-10-21T10:05:00.000Z"),
  });
  expect(await run(outcome("delayed", "2026-10-21T10:00:00.000Z"))).toEqual({
    recorded: false,
  });
  expect(rows.get("emdel_1").outcome).toBe("bounced");
});

it("retries while the receipt is unknown, then gives up quietly", async () => {
  const { run } = setup();
  const event = outcome("delivered", "2026-10-21T10:00:00.000Z");
  await expect(run(event, 1)).rejects.toThrow("provider receipt");
  expect(await run(event, 4)).toEqual({ recorded: false });
});
