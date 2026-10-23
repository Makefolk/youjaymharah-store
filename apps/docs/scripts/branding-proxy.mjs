import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { publicBrand } from "../.vitepress/theme/branding.js";

async function localEnvironment(directory) {
  const values = {};
  for (const filename of [".env", ".env.local"]) {
    try {
      Object.assign(
        values,
        parseEnv(await readFile(new URL(filename, directory), "utf8")),
      );
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return values;
}

export async function loadBrandingConfig() {
  const storefront = await localEnvironment(
    new URL("../../storefront/", import.meta.url),
  );
  const docs = await localEnvironment(new URL("../", import.meta.url));
  return {
    backendUrl:
      process.env.DOCS_MEDUSA_BACKEND_URL ??
      docs.DOCS_MEDUSA_BACKEND_URL ??
      process.env.MEDUSA_BACKEND_URL ??
      storefront.MEDUSA_BACKEND_URL ??
      "http://localhost:9000",
    publishableKey:
      process.env.DOCS_MEDUSA_PUBLISHABLE_KEY ??
      docs.DOCS_MEDUSA_PUBLISHABLE_KEY ??
      process.env.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ??
      storefront.NEXT_PUBLIC_MEDUSA_PUBLISHABLE_KEY ??
      "",
  };
}

export function createBrandingHandler(config, fetchBrand = fetch) {
  return async function branding(req, res, next) {
    if (req.url?.split("?")[0] !== "/api/branding") return next();
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("X-Content-Type-Options", "nosniff");
    if (req.method !== "GET" && req.method !== "HEAD") {
      res.statusCode = 405;
      res.setHeader("Allow", "GET, HEAD");
      res.end(JSON.stringify({ error: "Method not allowed" }));
      return;
    }
    let brand = null;
    try {
      if (config.publishableKey) {
        const endpoint = new URL(
          "/store/storefront-settings",
          config.backendUrl,
        );
        if (
          !["https:", "http:"].includes(endpoint.protocol) ||
          endpoint.username ||
          endpoint.password
        ) {
          throw new Error("Invalid branding backend URL");
        }
        const response = await fetchBrand(endpoint, {
          headers: { "x-publishable-api-key": config.publishableKey },
          signal: AbortSignal.timeout(5000),
          redirect: "error",
        });
        if (response.ok)
          brand = publicBrand((await response.json())?.settings?.brand);
      }
    } catch {
      // Branding must not prevent access to incident and recovery guides.
    }
    res.end(
      req.method === "HEAD"
        ? undefined
        : JSON.stringify({ settings: { brand } }),
    );
  };
}
