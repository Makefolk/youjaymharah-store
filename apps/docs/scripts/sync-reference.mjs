import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { syncBrand } from "./sync-brand.mjs";

await syncBrand();

const app = fileURLToPath(new URL("..", import.meta.url));
const root = path.resolve(app, "../..");
const output = path.join(app, "content/reference/generated");
const sources = new Map([
  ["store-manager-handbook", "Store manager handbook"],
  ["deployment", "Deployment runbook"],
  ["email-reliability", "Email reliability"],
  ["resend-webhooks", "Resend webhooks"],
  ["announcements", "Announcements"],
  ["search-privacy", "Search privacy"],
  ["production-operations", "Production operations"],
]);

await mkdir(output, { recursive: true });
for (const [slug, title] of sources) {
  const original = await readFile(
    path.join(root, "docs", `${slug}.md`),
    "utf8",
  );
  const body = original
    .replace(/^# .+\r?\n/, "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, target) => {
      if (/^(?:https?:|mailto:|#)/.test(target)) return match;
      const [file, anchor] = target.split("#");
      const name = path.basename(file, ".md");
      if (sources.has(name)) {
        return `[${label}](/reference/generated/${name}${anchor ? `#${anchor}` : ""})`;
      }
      return `${label} (repository file: \`${target}\`)`;
    });
  await writeFile(
    path.join(output, `${slug}.md`),
    `---\ntitle: ${JSON.stringify(title)}\n---\n\n# ${title}\n\nSource: \`docs/${slug}.md\`. Imported at build time; edit the source runbook.\n\n${body}`,
  );
}

const contractText = await readFile(
  path.join(root, "docs/api/openapi.json"),
  "utf8",
);
const contract = JSON.parse(contractText);
const methods = ["get", "post", "put", "patch", "delete", "head", "options"];
const rows = [];
const detail = [];
function markdownText(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("{{", "&#123;&#123;");
}
let count = 0;
for (const [route, entry] of Object.entries(contract.paths ?? {}).sort(
  ([a], [b]) => a.localeCompare(b),
)) {
  for (const method of methods) {
    const operation = entry[method];
    if (!operation) continue;
    count += 1;
    const anchor = `operation-${count}`;
    rows.push(
      `| ${method.toUpperCase()} | [\`${route}\`](#${anchor}) | ${markdownText(
        operation.summary ?? "",
      )
        .replaceAll("|", "\\|")
        .replaceAll("\n", " ")} |`,
    );
    const parameters = [
      ...(entry.parameters ?? []),
      ...(operation.parameters ?? []),
    ];
    const request = operation.requestBody;
    detail.push(
      `## ${method.toUpperCase()} ${route} {#${anchor}}`,
      markdownText(
        operation.description ??
          operation.summary ??
          "See the request and response contract below.",
      ),
      parameters.length
        ? `Parameters:\n\n\`\`\`json\n${JSON.stringify(parameters, null, 2)}\n\`\`\``
        : "No path/query parameters are declared beyond the route and middleware requirements.",
      request
        ? `Request body:\n\n\`\`\`json\n${JSON.stringify(request, null, 2)}\n\`\`\``
        : "No request body is declared.",
      `Responses:\n\n\`\`\`json\n${JSON.stringify(operation.responses ?? {}, null, 2)}\n\`\`\``,
    );
  }
}
await writeFile(
  path.join(output, "api.md"),
  [
    "---\ntitle: Custom API reference\n---",
    "# Custom API reference",
    `Generated from the checked-in OpenAPI contract: **${count} operations**. Run backend codegen after changing a route, then rebuild this site.`,
    "This reference covers the project's custom APIs. Native Medusa endpoints are documented in the [official API reference](https://docs.medusajs.com/api/store). Authentication and middleware still apply even when an operation has no explicit security field in the contract.",
    "Store calls need the publishable API key. Customer data also requires the appropriate customer or guest-access proof. Admin calls require an authenticated staff identity and the route's permission. Never put an admin token in browser code or an example checked into this handbook.",
    "[Download the complete OpenAPI contract](/api/openapi.json), including shared schemas referenced by `$ref` below.",
    "| Method | Path | Purpose |\n| --- | --- | --- |",
    rows.join("\n"),
    ...detail,
  ].join("\n\n") + "\n",
);
const apiOutput = path.join(app, "content/public/api");
await mkdir(apiOutput, { recursive: true });
await writeFile(path.join(apiOutput, "openapi.json"), contractText);
console.log(`Imported ${sources.size} runbooks and ${count} API operations.`);
