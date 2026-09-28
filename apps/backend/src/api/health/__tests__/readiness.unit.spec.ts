import { checkReadiness } from "../readiness";

describe("checkReadiness", () => {
  it("is ready when every dependency answers", async () => {
    await expect(
      checkReadiness({
        database: async () => "row",
        redis: async () => undefined,
      }),
    ).resolves.toEqual({
      ok: true,
      checks: { database: "ok", redis: "ok" },
    });
  });

  it("is not ready when any dependency fails, and says which", async () => {
    await expect(
      checkReadiness({
        database: async () => "row",
        redis: async () => {
          throw new Error("ECONNREFUSED redis:6379");
        },
      }),
    ).resolves.toEqual({
      ok: false,
      checks: { database: "ok", redis: "fail" },
    });
  });

  it("treats a dependency that never answers as failed, within the deadline", async () => {
    const started = Date.now();
    const result = await checkReadiness(
      {
        database: () => new Promise(() => undefined),
        redis: async () => undefined,
      },
      20,
    );

    expect(result).toEqual({
      ok: false,
      checks: { database: "fail", redis: "ok" },
    });
    expect(Date.now() - started).toBeLessThan(1000);
  });

  it("reports an unused dependency without failing on it", async () => {
    await expect(
      checkReadiness({ database: async () => "row", redis: null }),
    ).resolves.toEqual({
      ok: true,
      checks: { database: "ok", redis: "not_configured" },
    });
  });

  it("never carries an error message into the result", async () => {
    const result = await checkReadiness({
      database: async () => {
        throw new Error("password authentication failed for user medusa");
      },
    });

    expect(JSON.stringify(result)).not.toContain("password");
  });
});
