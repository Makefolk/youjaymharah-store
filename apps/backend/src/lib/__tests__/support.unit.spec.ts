import {
  checkAttachment,
  createSupportAccessToken,
  isValidSupportAccessToken,
  newSupportReference,
} from "../support";

describe("support helpers", () => {
  it("makes readable references without look-alike characters", () => {
    for (let i = 0; i < 200; i++) {
      expect(newSupportReference()).toMatch(/^SR-[2-9A-HJ-NP-Z]{6}$/);
    }
  });

  it("opens only its own request, for its own email", () => {
    const token = createSupportAccessToken("sreq_1", "Ada@Example.com");
    expect(isValidSupportAccessToken(token, "sreq_1", "ada@example.com")).toBe(
      true,
    );
    expect(isValidSupportAccessToken(token, "sreq_2", "ada@example.com")).toBe(
      false,
    );
    expect(isValidSupportAccessToken(token, "sreq_1", "eve@example.com")).toBe(
      false,
    );
    expect(isValidSupportAccessToken(undefined, "sreq_1", "a@b.c")).toBe(false);
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
