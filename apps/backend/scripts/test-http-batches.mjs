import { readdirSync } from "node:fs";
import { spawnSync } from "node:child_process";

const suites = readdirSync(
  new URL("../integration-tests/http/", import.meta.url),
)
  .filter((name) => /\.spec\.[jt]s$/.test(name))
  .sort();
const pnpm = process.env.npm_execpath;
if (!pnpm) throw new Error("Run this script through pnpm.");

// Each Medusa test runner loads the application. Recycling Jest bounds the
// accumulated module registry and heap without skipping any suites.
for (let offset = 0; offset < suites.length; offset += 5) {
  const batch = suites.slice(offset, offset + 5);
  const pattern = `/(${batch.map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})$`;
  const result = spawnSync(
    process.execPath,
    [pnpm, "run", "test:integration:http", pattern],
    {
      stdio: "inherit",
      env: process.env,
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
