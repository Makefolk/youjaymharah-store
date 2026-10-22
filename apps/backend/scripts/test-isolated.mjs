import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const backend = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const bin = [
  process.env.POSTGRES_BIN,
  "/opt/homebrew/opt/postgresql@15/bin",
  "/usr/lib/postgresql/15/bin",
].find((candidate) => candidate && existsSync(join(candidate, "initdb")));
if (!bin)
  throw new Error(
    "Set POSTGRES_BIN to your PostgreSQL 15 bin directory. No database was touched.",
  );

const probe = createServer();
await new Promise((ready, reject) => {
  probe.once("error", reject);
  probe.listen(0, "127.0.0.1", ready);
});
const port = probe.address().port;
await new Promise((done) => probe.close(done));
const temporary = mkdtempSync(join(tmpdir(), "youjaymharah-tests-"));
const data = join(temporary, "data");
const passwordFile = join(temporary, "test-password");
writeFileSync(passwordFile, "migration_test_only\n", { mode: 0o600 });
const env = {
  ...process.env,
  NODE_ENV: "test",
  MEDUSA_TEST_DB_ISOLATED: "1",
  // Medusa's test runner treats only the literal "localhost" as non-TLS.
  DB_HOST: "localhost",
  DB_PORT: String(port),
  DB_USERNAME: "medusa_test",
  DB_PASSWORD: "migration_test_only",
  DATABASE_URL: `postgres://medusa_test:migration_test_only@127.0.0.1:${port}/medusa_migration_test`,
  PGHOST: "127.0.0.1",
  PGPORT: String(port),
  PGUSER: "medusa_test",
  PGPASSWORD: "migration_test_only",
  PGDATABASE: "postgres",
  STORE_CORS: "http://localhost:8000",
  ADMIN_CORS: "http://localhost:9000",
  AUTH_CORS: "http://localhost:9000",
  JWT_SECRET: "migration_test_jwt_secret_not_for_production",
  COOKIE_SECRET: "migration_test_cookie_secret_not_for_production",
  REDIS_URL: "",
  GOOGLE_CLIENT_ID: "",
  GOOGLE_CLIENT_SECRET: "",
  GOOGLE_CALLBACK_URL: "",
  ADMIN_EMAIL: "",
  ADMIN_PASSWORD: "",
  SEARCH_TRENDING_TERMS: "[]",
  RESEND_API_KEY: "re_migration_test",
  EMAIL_DELIVERY_ENCRYPTION_KEY: "0123456789abcdef".repeat(4),
  RESEND_FROM_EMAIL: "test@example.com",
  RESEND_WEBHOOK_SECRET: "",
  CREDO_PUBLIC_KEY: "migration_test",
  CREDO_SECRET_KEY: "migration_test",
  CREDO_MODE: "test",
  CREDO_WEBHOOK_TOKEN: "",
  CREDO_BUSINESS_CODE: "",
  PAYSTACK_SECRET_KEY: "sk_test_migration",
  PAYMENT_CALLBACK_URL: "http://localhost:8000/checkout/callback",
  S3_FILE_URL: "https://example.com",
  S3_BUCKET: "migration-test",
  S3_REGION: "us-east-1",
  S3_ACCESS_KEY_ID: "migration_test",
  S3_SECRET_ACCESS_KEY: "migration_test",
  S3_ENDPOINT: "http://127.0.0.1:9",
};
function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: backend,
    env,
    stdio: "inherit",
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0)
    throw new Error(
      `${command} failed (exit ${result.status ?? result.signal}).`,
    );
}
let started = false;
try {
  console.log(`Isolated PostgreSQL test cluster: 127.0.0.1:${port}`);
  run(join(bin, "initdb"), [
    "-D",
    data,
    "-U",
    "medusa_test",
    "--pwfile",
    passwordFile,
    "--auth=scram-sha-256",
    "--encoding=UTF8",
    "--locale=C",
  ]);
  // A TCP-only, random-port cluster never shares the application's default socket.
  run(join(bin, "pg_ctl"), [
    "-D",
    data,
    "-l",
    join(temporary, "postgres.log"),
    "-o",
    `-h 127.0.0.1 -p ${port} -k ''`,
    "-w",
    "start",
  ]);
  started = true;
  run(join(bin, "createdb"), ["medusa_migration_test"]);
  const args = process.argv.slice(2);
  const generateModule = args[0] === "--generate-migration" ? args[1] : null;
  if (
    args[0] === "--generate-migration" &&
    (!generateModule || args.length !== 2)
  ) {
    throw new Error("Usage: test:isolated --generate-migration <module-name>");
  }
  const testsOnly = args[0] === "--tests-only";
  if (testsOnly) args.shift();
  if (!testsOnly) {
    run("pnpm", ["exec", "medusa", "db:migrate", "--skip-scripts"]);
    run("pnpm", ["exec", "medusa", "db:migrate", "--skip-scripts"]);
  }
  if (generateModule)
    run("pnpm", ["exec", "medusa", "db:generate", generateModule]);
  else
    run("pnpm", [
      "run",
      args.length ? "test:integration:http" : "test:integration:http:batches",
      ...args,
    ]);
} finally {
  if (started)
    run(join(bin, "pg_ctl"), ["-D", data, "-m", "fast", "-w", "stop"]);
  rmSync(temporary, { recursive: true, force: true });
  console.log(
    "Temporary test cluster removed; application databases were not used.",
  );
}
