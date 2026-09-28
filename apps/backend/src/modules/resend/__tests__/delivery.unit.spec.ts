import type { ILockingModule, Logger } from "@medusajs/framework/types";
import type EmailDeliveryModuleService from "../../email-delivery/service";
import ResendNotificationProviderService from "../service";
import { emailIdempotency } from "../idempotency";

jest.mock("../emails", () => ({
  resolveEmailTemplate: jest.fn(() => undefined),
}));

const originalFetch = global.fetch;
function ledger() {
  const rows = new Map<string, any>();
  const service = {
    listEmailDeliveries: jest.fn(async ({ id }) =>
      rows.has(id) ? [rows.get(id)] : [],
    ),
    createEmailDeliveries: jest.fn(async (data) => {
      const row = { status: "prepared", attempts: 0, ...data };
      rows.set(data.id, row);
      return row;
    }),
    updateEmailDeliveries: jest.fn(async (data) => {
      const row = { ...rows.get(data.id), ...data };
      rows.set(data.id, row);
      return row;
    }),
  } as unknown as EmailDeliveryModuleService;
  let pending = Promise.resolve<unknown>(undefined);
  const locking = {
    execute: (_key: string, job: () => Promise<unknown>) => {
      const result = pending.then(job);
      pending = result.catch(() => undefined);
      return result;
    },
  } as ILockingModule;
  return { service, locking, rows };
}
function setup(
  overrides: Partial<
    ConstructorParameters<typeof ResendNotificationProviderService>[1]
  > = {},
) {
  const store = ledger();
  const logger = { error: jest.fn() } as unknown as Logger;
  const options = {
    api_key: "re_test",
    from: "verified@example.com",
    encryption_key: "ab".repeat(32),
    ...overrides,
  };
  const provider = new ResendNotificationProviderService(
    { logger, emailDelivery: store.service, locking: store.locking },
    options,
  );
  const notification = {
    to: "buyer@example.com",
    channel: "email",
    template: "inline-test",
    content: { html: "Private token", text: "Private token", subject: "Test" },
    data: { reply_to: "support@example.com" },
    ...emailIdempotency("order:123"),
  };
  return { ...store, provider, notification, logger, options };
}
afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

it.each([
  ["email-verification", "Youjaymharah <onboarding@shop.example.com>"],
  ["password-reset", "Youjaymharah <accounts@shop.example.com>"],
  ["invite-user", "Youjaymharah <accounts@shop.example.com>"],
  ["order-placed", "Youjaymharah Orders <orders@shop.example.com>"],
  ["order-updated", "Youjaymharah Orders <orders@shop.example.com>"],
  ["order-shipped", "Youjaymharah Orders <orders@shop.example.com>"],
  ["order-delivered", "Youjaymharah Orders <orders@shop.example.com>"],
  ["order-canceled", "Youjaymharah Orders <orders@shop.example.com>"],
  ["refund-issued", "Youjaymharah Orders <orders@shop.example.com>"],
  ["return-requested", "Youjaymharah Orders <orders@shop.example.com>"],
  ["return-received", "Youjaymharah Orders <orders@shop.example.com>"],
  ["exchange-created", "Youjaymharah Orders <orders@shop.example.com>"],
  ["claim-created", "Youjaymharah Orders <orders@shop.example.com>"],
  ["newsletter-confirm", "The YJ Edit <hello@shop.example.com>"],
  ["newsletter-welcome", "The YJ Edit <hello@shop.example.com>"],
  ["product-back-in-stock", "The YJ Edit <hello@shop.example.com>"],
  ["product-launched", "The YJ Edit <hello@shop.example.com>"],
  ["cart-reminder", "The YJ Edit <hello@shop.example.com>"],
])(
  "sends %s with its sender and the configured Reply-To",
  async (template, from) => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: "email_1" })));
    const { provider, notification } = setup({
      from: "Old Sender <onboarding@shop.example.com>",
    });
    await provider.send({ ...notification, template });
    expect(
      JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body),
    ).toMatchObject({
      from,
      reply_to: "support@example.com",
    });
  },
);

it.each([
  ["email-verification", "onboarding"],
  ["password-reset", "accounts"],
  ["order-placed", "orders"],
  ["newsletter-confirm", "marketing"],
] as const)(
  "uses the configured %s sender override",
  async (template, group) => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(new Response(JSON.stringify({ id: "email_1" })));
    const { provider, notification } = setup({
      from_addresses: { [group]: "  Custom <hello@other.example.com>  " },
    });
    await provider.send({ ...notification, template });
    expect(
      JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).from,
    ).toBe("Custom <hello@other.example.com>");
  },
);

it("honors an explicit notification sender before the group override", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ id: "email_1" })));
  const { provider, notification } = setup({
    from_addresses: { marketing: "hello@marketing.example.com" },
  });
  await provider.send({
    ...notification,
    template: "newsletter-confirm",
    from: "  Personal <personal@example.com>  ",
  });
  expect(
    JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).from,
  ).toBe("Personal <personal@example.com>");
});

it("ignores blank sender overrides and derives from a bare email address", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ id: "email_1" })));
  const { provider, notification } = setup({
    from_addresses: { marketing: "   " },
  });
  await provider.send({
    ...notification,
    template: "newsletter-confirm",
    from: "  ",
  });
  expect(
    JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).from,
  ).toBe("The YJ Edit <hello@example.com>");
});

it("preserves Resend's shared testing sender", async () => {
  global.fetch = jest
    .fn()
    .mockResolvedValue(new Response(JSON.stringify({ id: "email_1" })));
  const { provider, notification } = setup({
    from: "Test <onboarding@resend.dev>",
  });
  await provider.send({ ...notification, template: "newsletter-confirm" });
  expect(
    JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).from,
  ).toBe("Test <onboarding@resend.dev>");
});
it("sends the same provider idempotency key on retries and keeps Reply-To separate", async () => {
  global.fetch = jest
    .fn()
    .mockImplementation(
      async () => new Response(JSON.stringify({ id: "email_1" })),
    );
  const { provider } = setup();
  const notification = {
    to: "buyer@example.com",
    channel: "email",
    template: "inline-test",
    content: { html: "Hello", subject: "Test" },
    data: { reply_to: "support@example.com" },
    ...emailIdempotency("order:123"),
  };
  await provider.send(notification);
  await provider.send(notification);
  const calls = (global.fetch as jest.Mock).mock.calls;
  expect(calls).toHaveLength(1);
  for (const [, options] of calls) {
    expect(new Headers(options.headers).get("Idempotency-Key")).toBe(
      notification.provider_data.idempotency_key,
    );
    expect(JSON.parse(options.body)).toMatchObject({
      from: "verified@example.com",
      reply_to: "support@example.com",
    });
    expect(options.signal).toBeInstanceOf(AbortSignal);
  }
});

it("persists an encrypted snapshot and reuses the original content after an ambiguous failure", async () => {
  const { provider, notification, rows, options } = setup();
  notification.template = "newsletter-confirm";
  global.fetch = jest
    .fn()
    .mockRejectedValueOnce(new Error("request timed out for buyer@example.com"))
    .mockResolvedValue(new Response(JSON.stringify({ id: "email_1" })));
  await expect(provider.send(notification)).rejects.toThrow(
    "acceptance was not confirmed",
  );
  const saved = [...rows.values()][0];
  expect(saved.status).toBe("attempted");
  expect(JSON.stringify(saved)).not.toContain("Private token");
  expect(JSON.stringify(saved)).not.toContain("buyer@example.com");
  notification.content.html = "Changed template";
  notification.to = "changed@example.com";
  options.from_addresses = { marketing: "Changed <hello@new.example.com>" };
  await provider.send(notification);
  const calls = (global.fetch as jest.Mock).mock.calls;
  expect(calls[1][1].body).toBe(calls[0][1].body);
  expect([...rows.values()][0]).toMatchObject({
    status: "accepted",
    payload_ciphertext: null,
    attempts: 2,
  });
});

it("does not resend accepted mail beyond the provider deduplication window", async () => {
  const { provider, notification } = setup();
  global.fetch = jest
    .fn()
    .mockImplementation(
      async () => new Response(JSON.stringify({ id: "email_1" })),
    );
  await provider.send(notification);
  const now = Date.now();
  jest.spyOn(Date, "now").mockReturnValue(now + 48 * 60 * 60 * 1000);
  expect(await provider.send(notification)).toEqual({ id: "email_1" });
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

it("blocks an unresolved send after the safe window rather than risking a duplicate", async () => {
  const { provider, notification, rows } = setup();
  global.fetch = jest.fn().mockRejectedValue(new Error("timeout"));
  await expect(provider.send(notification)).rejects.toThrow();
  const now = Date.now();
  jest.spyOn(Date, "now").mockReturnValue(now + 24 * 60 * 60 * 1000);
  await expect(provider.send(notification)).rejects.toThrow("review required");
  await expect(provider.send(notification)).rejects.toThrow("requires review");
  expect(global.fetch).toHaveBeenCalledTimes(1);
  expect([...rows.values()][0].status).toBe("needs_review");
});

it("recovers a failed receipt write using the same saved provider request", async () => {
  const { provider, notification, service } = setup();
  global.fetch = jest
    .fn()
    .mockImplementation(
      async () => new Response(JSON.stringify({ id: "email_1" })),
    );
  const update = (
    service.updateEmailDeliveries as jest.Mock
  ).getMockImplementation();
  (service.updateEmailDeliveries as jest.Mock)
    .mockImplementationOnce(update!)
    .mockRejectedValueOnce(new Error("database unavailable"));
  await expect(provider.send(notification)).rejects.toThrow();
  await provider.send(notification);
  const calls = (global.fetch as jest.Mock).mock.calls;
  expect(calls).toHaveLength(2);
  expect(calls[1][1].body).toBe(calls[0][1].body);
  expect(new Headers(calls[1][1].headers).get("Idempotency-Key")).toBe(
    new Headers(calls[0][1].headers).get("Idempotency-Key"),
  );
});

it("serializes concurrent delivery calls and sends only once", async () => {
  const { provider, notification } = setup();
  global.fetch = jest
    .fn()
    .mockImplementation(
      async () => new Response(JSON.stringify({ id: "email_1" })),
    );
  await Promise.all([provider.send(notification), provider.send(notification)]);
  expect(global.fetch).toHaveBeenCalledTimes(1);
});

it("fails closed before sending when the ledger is unavailable or identity is missing", async () => {
  const { provider, notification, service } = setup();
  global.fetch = jest.fn();
  (service.listEmailDeliveries as jest.Mock).mockRejectedValue(
    new Error("database unavailable"),
  );
  await expect(provider.send(notification)).rejects.toThrow(
    "database unavailable",
  );
  await expect(
    provider.send({ ...notification, provider_data: {} }),
  ).rejects.toThrow("stable delivery identity");
  expect(global.fetch).not.toHaveBeenCalled();
});

it("separates retry bookkeeping from the stable provider delivery identity", () => {
  const first = emailIdempotency("alert:123", 0);
  const retry = emailIdempotency("alert:123", 1);
  expect(first.idempotency_key).not.toBe(retry.idempotency_key);
  expect(first.provider_data).toEqual(retry.provider_data);
  expect(emailIdempotency("order:123").idempotency_key).toBeUndefined();
});

it("logs Resend's reason for a refusal without the addresses in it", async () => {
  const { provider, notification, logger } = setup();
  // The SDK prints raw errors itself outside production; keep the run quiet.
  jest.spyOn(console, "error").mockImplementation(() => {});
  global.fetch = jest.fn().mockResolvedValue(
    new Response(
      JSON.stringify({
        statusCode: 403,
        name: "validation_error",
        message:
          "You can only send testing emails to your own email address (owner@example.com).",
      }),
      { status: 403 },
    ),
  );

  await expect(provider.send(notification)).rejects.toThrow(
    "acceptance was not confirmed",
  );

  const [line] = (logger.error as jest.Mock).mock.calls[0];
  expect(line).toContain("validation_error 403");
  expect(line).toContain("your own email address ([email])");
  expect(line).not.toContain("owner@example.com");
  expect(line).not.toContain("buyer@example.com");
  jest.restoreAllMocks();
});
