import path from "node:path";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";

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

async function applyCommittedMigrations(databaseUrl) {
  const migrationsFolder = path.resolve(process.cwd(), "drizzle");
  const pool = new pg.Pool({
    connectionString: databaseUrl,
    max: 1,
    idleTimeoutMillis: 30_000,
  });

  try {
    const db = drizzle(pool);
    await migrate(db, { migrationsFolder });
    console.log("[db:push] ✅ Committed drizzle migrations applied.");
    return true;
  } catch (error) {
    console.warn(
      `[db:push] ⚠️  drizzle migration failed: ${error?.message ?? String(error)}`
    );
    return false;
  } finally {
    try {
      await pool.end();
    } catch {
      // ignore close errors
    }
  }
}

async function alignTableSchemas(databaseUrl) {
  console.log("[db:push] Aligning table schemas...");
  const { Client } = pg;
  const alignClient = new Client({
    connectionString: databaseUrl,
    statement_timeout: 30000,
    query_timeout: 30000,
  });
  try {
    await alignClient.connect();
    const alters = [
      `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "memberMlsId" varchar(255)`,
      `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "officeKey" varchar(255)`,
      `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "memberStateLicense" varchar(100)`,
      `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "memberNationalAssociationId" varchar(100)`,
      `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "memberFullName" varchar(255)`,
      `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "memberMobilePhone" varchar(50)`,
      `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "memberDirectPhone" varchar(50)`,
      `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "mediaURL" text`,
      `ALTER TABLE IF EXISTS "members" ADD COLUMN IF NOT EXISTS "memberLastName" varchar(100)`,
      `ALTER TABLE IF EXISTS "offices" ADD COLUMN IF NOT EXISTS "officeMlsId" varchar(255)`,
      `ALTER TABLE IF EXISTS "offices" ADD COLUMN IF NOT EXISTS "officeLatitude" varchar(20)`,
      `ALTER TABLE IF EXISTS "offices" ADD COLUMN IF NOT EXISTS "officeLongitude" varchar(20)`,
      `ALTER TABLE IF EXISTS "offices" ADD COLUMN IF NOT EXISTS "mediaURL" text`,
      `ALTER TABLE IF EXISTS "open_houses" ADD COLUMN IF NOT EXISTS "appointmentRequired" integer`,
      `ALTER TABLE IF EXISTS "open_houses" ADD COLUMN IF NOT EXISTS "remarks" text`,
      `ALTER TABLE IF EXISTS "open_houses" ADD COLUMN IF NOT EXISTS "openHouseStartTime" timestamp`,
      `ALTER TABLE IF EXISTS "open_houses" ADD COLUMN IF NOT EXISTS "openHouseEndTime" timestamp`,
    ];
    let applied = 0;
    for (const sql of alters) {
      try {
        await alignClient.query(sql);
        applied++;
      } catch (error) {
        console.warn(`[db:push] ALTER skip: ${error.message}`);
      }
    }
    console.log(`[db:push] ✅ Schema alignment complete (${applied}/${alters.length} columns checked).`);
  } catch (error) {
    console.warn(`[db:push] ⚠️ Schema alignment failed: ${error.message}`);
  } finally {
    try {
      await alignClient.end();
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

const TIMEOUT_MS = 90_000;
const safetyTimer = setTimeout(() => {
  console.error(
    `[db:push] TIMEOUT after ${TIMEOUT_MS / 1000}s — forcing exit to allow server startup.`
  );
  process.exit(0);
}, TIMEOUT_MS);
safetyTimer.unref();

const hasVector = await ensurePgVectorExtension(databaseUrl);
if (!hasVector && !strictMode) {
  console.warn(
    "[db:push] Skipping migrations because pgvector is unavailable (non-strict mode)."
  );
  process.exit(0);
}

console.log("[db:push] Applying committed drizzle migrations...");
const migrated = await applyCommittedMigrations(databaseUrl);
await alignTableSchemas(databaseUrl);

if (!migrated && strictMode) {
  process.exit(1);
}

if (!migrated) {
  console.warn("[db:push] Continuing startup after migration failure (non-strict mode).");
  process.exit(0);
}

process.exit(0);
