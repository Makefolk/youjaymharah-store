import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import sirv from "sirv";
import {
  createBrandingHandler,
  loadBrandingConfig,
} from "./branding-proxy.mjs";

const directory = fileURLToPath(new URL("../dist/", import.meta.url));
const notFound = await readFile(new URL("../dist/404.html", import.meta.url));
const branding = createBrandingHandler(await loadBrandingConfig());
const serve = sirv(directory, { extensions: ["html"], etag: true });
const port = Number(process.env.DOCS_PORT ?? 8001);

createServer((req, res) => {
  res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
  res.setHeader("Cache-Control", "private, no-cache");
  res.setHeader("X-Content-Type-Options", "nosniff");
  if (!["GET", "HEAD"].includes(req.method)) {
    res.writeHead(405, { Allow: "GET, HEAD" });
    res.end();
    return;
  }
  branding(req, res, () =>
    serve(req, res, () => {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      res.end(req.method === "HEAD" ? undefined : notFound);
    }),
  );
}).listen(port, "127.0.0.1", () => {
  console.log(`Docs preview: http://127.0.0.1:${port}`);
});
