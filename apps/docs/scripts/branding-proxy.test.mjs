import assert from "node:assert/strict";
import test from "node:test";
import { createBrandingHandler } from "./branding-proxy.mjs";
import { publicImageUrl } from "../.vitepress/theme/branding.js";

const config = {
  backendUrl: "https://api.example.test",
  publishableKey: "pk_test_docs",
};

async function request(handler, overrides = {}) {
  const result = { statusCode: 200, headers: {}, body: undefined, next: false };
  const res = {
    setHeader: (name, value) => {
      result.headers[name.toLowerCase()] = value;
    },
    end: (body) => {
      result.body = body === undefined ? undefined : JSON.parse(body);
    },
    set statusCode(value) {
      result.statusCode = value;
    },
  };
  await handler(
    { url: "/api/branding", method: "GET", ...overrides },
    res,
    () => {
      result.next = true;
    },
  );
  return result;
}

test("uses only public branding and never forwards docs credentials or a requested target", async () => {
  let upstream;
  const handler = createBrandingHandler(config, async (url, options) => {
    upstream = { url: url.href, ...options };
    return Response.json({
      settings: {
        brand: {
          name: "Brand",
          logo_url: "https://cdn.example.test/logo.svg",
          favicon_url: null,
          support_email: "support@example.test",
          private_field: "omit",
        },
        unrelated: "omit",
      },
    });
  });
  const result = await request(handler, {
    url: "/api/branding?url=https://untrusted.example",
    headers: {
      authorization: "Basic docs-credential",
      cookie: "session=private",
    },
  });
  assert.equal(
    upstream.url,
    "https://api.example.test/store/storefront-settings",
  );
  assert.deepEqual(upstream.headers, {
    "x-publishable-api-key": "pk_test_docs",
  });
  assert.equal(upstream.redirect, "error");
  assert.ok(upstream.signal instanceof AbortSignal);
  assert.deepEqual(result.body, {
    settings: {
      brand: {
        name: "Brand",
        logo_url: "https://cdn.example.test/logo.svg",
        favicon_url: null,
      },
    },
  });
  assert.equal(result.headers["cache-control"], "private, no-store");
});

test("unconfigured or unavailable backends leave a usable fallback", async () => {
  for (const fetchBrand of [
    async () => {
      throw new Error("Unavailable with sensitive diagnostic");
    },
    async () => new Response("Unauthorized", { status: 401 }),
    async () => new Response("not json"),
  ]) {
    assert.deepEqual(
      (await request(createBrandingHandler(config, fetchBrand))).body,
      { settings: { brand: null } },
    );
  }
  const disabled = createBrandingHandler(
    { ...config, publishableKey: "" },
    async () => {
      assert.fail("No key must not make a backend request");
    },
  );
  assert.deepEqual((await request(disabled)).body, {
    settings: { brand: null },
  });
});

test("refuses unsafe image URLs and credentials in image URLs", () => {
  for (const url of [
    "javascript:alert(1)",
    "data:image/svg+xml,test",
    "file:///secret",
    "//external.test/logo",
    "https://user:password@cdn.example.test/logo",
    null,
  ]) {
    assert.equal(publicImageUrl(url), null);
  }
  assert.equal(
    publicImageUrl("https://cdn.example.test/logo.png"),
    "https://cdn.example.test/logo.png",
  );
});

test("refuses unsafe backend configuration without contacting it", async () => {
  for (const backendUrl of [
    "file:///tmp/settings",
    "https://user:password@api.example.test",
  ]) {
    const handler = createBrandingHandler(
      { ...config, backendUrl },
      async () => {
        assert.fail("Invalid URL must not be fetched");
      },
    );
    assert.deepEqual((await request(handler)).body, {
      settings: { brand: null },
    });
  }
});

test("does not accept mutations or intercept other docs paths", async () => {
  const handler = createBrandingHandler(config, async () => {
    assert.fail("Unexpected backend request");
  });
  assert.equal((await request(handler, { method: "POST" })).statusCode, 405);
  assert.equal((await request(handler, { url: "/staff/daily" })).next, true);
});

test("HEAD has no response body", async () => {
  const handler = createBrandingHandler(config, async () =>
    Response.json({ settings: { brand: { name: "Brand" } } }),
  );
  assert.equal((await request(handler, { method: "HEAD" })).body, undefined);
});
