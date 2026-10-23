import {
  checkAttachment,
  createSupportAccessToken,
  isValidSupportAccessToken,
  newSupportReference,
  SUPPORT_ACCESS_TTL_MS,
} from "../support";

describe("support helpers", () => {
  it("makes readable references without look-alike characters", () => {
    for (let i = 0; i < 200; i++) {
      expect(newSupportReference()).toMatch(/^SR-[2-9A-HJ-NP-Z]{6}$/);
    }
  });

  it("opens only its own request, for its own email", () => {
    const token = createSupportAccessToken("sreq_1", "Ada@Example.com");
    const request = { id: "sreq_1", email: "ada@example.com" };
    expect(isValidSupportAccessToken(token, request)).toBe(true);
    expect(isValidSupportAccessToken(token, { ...request, id: "sreq_2" })).toBe(
      false,
    );
    expect(
      isValidSupportAccessToken(token, {
        ...request,
        email: "eve@example.com",
      }),
    ).toBe(false);
    expect(isValidSupportAccessToken(undefined, request)).toBe(false);
  });

  it("expires, and stops working once staff cancel the links", () => {
    const now = Date.UTC(2026, 9, 23);
    const request = { id: "sreq_1", email: "ada@example.com" };
    const token = createSupportAccessToken(request.id, request.email, now);
    expect(
      isValidSupportAccessToken(
        token,
        request,
        now + SUPPORT_ACCESS_TTL_MS + 1,
      ),
    ).toBe(false);

    const cancelled = { ...request, links_revoked_at: new Date(now + 1000) };
    expect(isValidSupportAccessToken(token, cancelled, now + 2000)).toBe(false);
    const fresh = createSupportAccessToken(
      request.id,
      request.email,
      now + 3000,
    );
    expect(isValidSupportAccessToken(fresh, cancelled, now + 4000)).toBe(true);
  });

  it("refuses a tampered expiry", () => {
    const now = Date.UTC(2026, 9, 23);
    const request = { id: "sreq_1", email: "ada@example.com" };
    const [, signature] = createSupportAccessToken(
      request.id,
      request.email,
      now,
    ).split(".");
    expect(
      isValidSupportAccessToken(
        `${now + 10 * SUPPORT_ACCESS_TTL_MS}.${signature}`,
        request,
        now,
      ),
    ).toBe(false);
  });

  it("accepts images by their bytes only", () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]).toString(
      "base64",
    );
    expect(checkAttachment(jpeg)).toMatchObject({
      ok: true,
      type: "image/jpeg",
    });
    const html = Buffer.from("<html><script>").toString("base64");
    expect(checkAttachment(html)).toMatchObject({ ok: false });
    const huge = Buffer.alloc(3 * 1024 * 1024 + 1, 0xff);
    huge[1] = 0xd8;
    expect(checkAttachment(huge.toString("base64"))).toMatchObject({
      ok: false,
      error: expect.stringContaining("3 MB"),
    });
  });
});
