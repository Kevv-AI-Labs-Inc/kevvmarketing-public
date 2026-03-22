import { spawnSync } from "node:child_process";
import pg from "pg";

const DIRECT_DATABASE_URL_KEYS = [
  "DATABASE_URL",
  "DATABASE_PRIVATE_URL",
  "POSTGRES_URL",
  "POSTGRESQL_URL",
  "PGDATABASE_URL",
];

function readFirstNonEmpty(keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function resolveDatabaseUrl() {
  const direct = readFirstNonEmpty(DIRECT_DATABASE_URL_KEYS);
  if (direct) return direct;

  const host = readFirstNonEmpty(["PGHOST", "POSTGRES_HOST"]);
  if (!host) return null;

  const port = readFirstNonEmpty(["PGPORT", "POSTGRES_PORT"]) ?? "5432";
  const database =
    readFirstNonEmpty(["PGDATABASE", "POSTGRES_DB", "POSTGRES_DATABASE"]) ?? "postgres";
  const user = readFirstNonEmpty(["PGUSER", "POSTGRES_USER"]);
  const password = readFirstNonEmpty(["PGPASSWORD", "POSTGRES_PASSWORD"]);

  const auth =
    user && password
      ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}@`
      : user
        ? `${encodeURIComponent(user)}@`
        : "";

  return `postgresql://${auth}${host}:${port}/${encodeURIComponent(database)}`;
}

function run(command, args) {
  const result = spawnSync(command, args, {
    env: process.env,
    encoding: "utf-8",
  });

  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;

  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);

  return {
    status: result.status ?? 1,
    output,
  };
}

function isBenignDrizzleError(output) {
  const normalized = output.toLowerCase();
  return (
    normalized.includes("already exists") ||
    normalized.includes("code: '42710'") ||
    normalized.includes("code: '42p07'") ||
    normalized.includes('type "role" already exists')
  );
}

async function ensurePgVectorExtension(databaseUrl) {
  const { Client } = pg;
  const client = new Client({ connectionString: databaseUrl });
  try {
    await client.connect();
    await client.query("CREATE EXTENSION IF NOT EXISTS vector");
    console.log("[db:push] ✅ pgvector extension is available.");
    return true;
  } catch (error) {
    console.warn(
      `[db:push] ⚠️  pgvector extension unavailable: ${error?.message ?? String(error)}`
    );
    return false;
  } finally {
    try {
      await client.end();
    } catch {
      // ignore close errors
    }
  }
}

const databaseUrl = resolveDatabaseUrl();
if (!databaseUrl) {
  console.warn(
    "[db:push] Skip migrations: no database URL found. Set DATABASE_URL or PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE."
  );
  process.exit(0);
}

process.env.DATABASE_URL = databaseUrl;
const strictMode = process.env.DB_PUSH_STRICT === "true";

// Safety timeout: kill the script if it hangs for more than 90 seconds
const TIMEOUT_MS = 90_000;
const safetyTimer = setTimeout(() => {
  console.error(`[db:push] TIMEOUT after ${TIMEOUT_MS / 1000}s — forcing exit to allow server startup.`);
  process.exit(0);
}, TIMEOUT_MS);
safetyTimer.unref(); // don't prevent exit if script finishes normally

const hasVector = await ensurePgVectorExtension(databaseUrl);
if (!hasVector && !strictMode) {
  console.warn(
    "[db:push] Skipping drizzle migrations because pgvector is unavailable (non-strict mode)."
  );
  process.exit(0);
}

// ── Schema alignment function ──
// Always runs regardless of drizzle migrate outcome to fix columns
// missing from old CREATE TABLE scripts.
async function alignTableSchemas() {
  console.log("[db:push] Aligning table schemas...");
  const { Client } = pg;
  const alignClient = new Client({ connectionString: databaseUrl, statement_timeout: 30000, query_timeout: 30000 });
  try {
    await alignClient.connect();
    const alters = [
      // members table
      `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "memberMlsId" varchar(255)`,
      `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "officeKey" varchar(255)`,
      `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "memberStateLicense" varchar(100)`,
      `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "memberNationalAssociationId" varchar(100)`,
      `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "memberFullName" varchar(255)`,
      `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "memberMobilePhone" varchar(50)`,
      `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "memberDirectPhone" varchar(50)`,
      `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "mediaURL" text`,
      `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "memberLastName" varchar(100)`,
      // offices table
      `ALTER TABLE IF EXISTS "offices" ADD COLUMN IF NOT EXISTS "officeMlsId" varchar(255)`,
      `ALTER TABLE IF EXISTS "offices" ADD COLUMN IF NOT EXISTS "officeLatitude" varchar(20)`,
      `ALTER TABLE IF EXISTS "offices" ADD COLUMN IF NOT EXISTS "officeLongitude" varchar(20)`,
      `ALTER TABLE IF EXISTS "offices" ADD COLUMN IF NOT EXISTS "mediaURL" text`,
      // open_houses table
      `ALTER TABLE IF EXISTS "open_houses" ADD COLUMN IF NOT EXISTS "appointmentRequired" integer`,
      `ALTER TABLE IF EXISTS "open_houses" ADD COLUMN IF NOT EXISTS "remarks" text`,
      `ALTER TABLE IF EXISTS "open_houses" ADD COLUMN IF NOT EXISTS "openHouseStartTime" timestamp`,
      `ALTER TABLE IF EXISTS "open_houses" ADD COLUMN IF NOT EXISTS "openHouseEndTime" timestamp`,
    ];
    let applied = 0;
    for (const sql of alters) {
      try { await alignClient.query(sql); applied++; }
      catch (e) { console.warn(`[db:push] ALTER skip: ${e.message}`); }
    }
    console.log(`[db:push] ✅ Schema alignment complete (${applied}/${alters.length} columns checked).`);
  } catch (e) {
    console.warn(`[db:push] ⚠️ Schema alignment failed: ${e.message}`);
  } finally {
    try { await alignClient.end(); } catch { }
  }
}

console.log("[db:push] Running drizzle generate + migrate...");

const generateResult = run("pnpm", ["drizzle-kit", "generate"]);
if (generateResult.status !== 0) {
  const message = `[db:push] drizzle generate failed with exit code ${generateResult.status}.`;
  if (strictMode) {
    console.error(message);
    await alignTableSchemas();
    process.exit(generateResult.status);
  }
  console.warn(`${message} Continuing startup (non-strict mode).`);
  await alignTableSchemas();
  process.exit(0);
}

const migrateResult = run("pnpm", ["drizzle-kit", "migrate"]);
if (migrateResult.status !== 0) {
  const benign = isBenignDrizzleError(migrateResult.output);
  if (benign) {
    console.warn(
      "[db:push] Detected existing-schema migration conflict (already exists). Continuing startup."
    );
    await alignTableSchemas();
    process.exit(0);
  }

  const message = `[db:push] drizzle migrate failed with exit code ${migrateResult.status}.`;
  if (strictMode) {
    console.error(message);
    await alignTableSchemas();
    process.exit(migrateResult.status);
  }
  console.warn(`${message} Continuing startup (non-strict mode).`);
  await alignTableSchemas();
  process.exit(0);
}

console.log("[db:push] ✅ Migrations applied.");
await alignTableSchemas();
process.exit(0);
