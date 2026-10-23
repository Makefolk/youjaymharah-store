import { requireAdminMfa } from "../admin-mfa";

describe("two-factor for staff", () => {
  const original = process.env.ADMIN_MFA_REQUIRED;
  afterEach(() => {
    process.env.ADMIN_MFA_REQUIRED = original;
  });

  function run(
    method: string,
    auth: Record<string, unknown> | undefined,
    factors: unknown[],
  ) {
    const entries = new Map();
    const scope = {
      resolve: (key: string) =>
        key === "auth"
          ? { listAuthMfa: async () => factors }
          : {
              get: async ({ key }: { key: string }) => entries.get(key),
              set: async ({ key, data }: { key: string; data: unknown }) =>
                entries.set(key, data),
            },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    } as any;
    const next = jest.fn();
    return requireAdminMfa(
      { method, auth_context: auth, scope } as any,
      res,
      next,
    ).then(() => ({ res, next }));
  }

  const staff = {
    actor_type: "user",
    actor_id: "user_1",
    auth_identity_id: "authid_1",
  };

  it("lets staff without an authenticator view but not change anything", async () => {
    process.env.ADMIN_MFA_REQUIRED = "true";
    expect((await run("GET", staff, [])).next).toHaveBeenCalled();
    const change = await run("POST", staff, []);
    expect(change.next).not.toHaveBeenCalled();
    expect(change.res.status).toHaveBeenCalledWith(403);
  });

  it("lets staff with an authenticator, and API keys, through", async () => {
    process.env.ADMIN_MFA_REQUIRED = "true";
    expect(
      (await run("POST", staff, [{ id: "mfa_1" }])).next,
    ).toHaveBeenCalled();
    expect(
      (await run("POST", { actor_type: "api-key", actor_id: "apk_1" }, []))
        .next,
    ).toHaveBeenCalled();
  });

  it("does nothing until switched on", async () => {
    delete process.env.ADMIN_MFA_REQUIRED;
    expect((await run("POST", staff, [])).next).toHaveBeenCalled();
  });
});
