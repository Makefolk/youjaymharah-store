import { resolveReplyTo } from "../email-sender";

const options = { from: "Store <orders@example.com>" };

describe("resolveReplyTo", () => {
  it("prefers the email's own reply-to", () => {
    expect(
      resolveReplyTo(
        {
          reply_to: "editor@example.com",
          brand: { support_email: "support@example.com" },
        },
        { ...options, reply_to: "fallback@example.com" },
      ),
    ).toBe("editor@example.com");
  });

  it("uses the brand's support address next", () => {
    expect(
      resolveReplyTo(
        { brand: { support_email: " support@example.com " } },
        { ...options, reply_to: "fallback@example.com" },
      ),
    ).toBe("support@example.com");
  });

  it("falls back to the configured address when the brand has none", () => {
    expect(
      resolveReplyTo(
        { reply_to: "", brand: { support_email: null } },
        { ...options, reply_to: "fallback@example.com" },
      ),
    ).toBe("fallback@example.com");
  });

  it("sets nothing when no address is known", () => {
    expect(resolveReplyTo(undefined, options)).toBeUndefined();
  });
});
