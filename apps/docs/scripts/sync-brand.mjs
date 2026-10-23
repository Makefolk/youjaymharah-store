import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const storefrontStyles = fileURLToPath(
  new URL("../../storefront/app/globals.css", import.meta.url),
);
const output = new URL("../.vitepress/theme/generated/", import.meta.url);
const tokens = new Set([
  "radius",
  "background",
  "foreground",
  "card",
  "card-foreground",
  "popover",
  "popover-foreground",
  "primary",
  "primary-foreground",
  "secondary",
  "secondary-foreground",
  "muted",
  "muted-foreground",
  "accent",
  "accent-foreground",
  "border",
  "input",
  "ring",
  "destructive",
  "gold",
  "gold-light",
  "gold-foreground",
  "gold-hairline",
  "ink",
  "ink-foreground",
  "scrim",
  "sale",
]);

export async function syncBrand() {
  const source = (await readFile(storefrontStyles, "utf8")).replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  const blocks = [":root", ".dark"].map((selector) => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const body = source.match(new RegExp(`${escaped}\\s*\\{([^}]*)\\}`))?.[1];
    if (!body) throw new Error(`Missing storefront color block: ${selector}`);
    const values = [...body.matchAll(/--([a-z-]+):\s*([^;]+);/g)]
      .filter(([, name]) => tokens.has(name))
      .map(
        ([, name, value]) =>
          `  --store-${name}: ${value.replace(/\s+/g, " ").trim()};`,
      );
    if (!values.some((value) => value.startsWith("  --store-gold:"))) {
      throw new Error(`Missing storefront gold token: ${selector}`);
    }
    return `${selector} {\n${values.join("\n")}\n}`;
  });
  await mkdir(output, { recursive: true });
  await writeFile(
    new URL("brand-tokens.css", output),
    `/* Generated from apps/storefront/app/globals.css. */\n${blocks.join("\n\n")}\n`,
  );
}
