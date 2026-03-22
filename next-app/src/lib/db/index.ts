import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";
import { resolveDatabaseUrl } from "@/server/_core/database-url";

function getDatabaseUrl() {
  const url = resolveDatabaseUrl();
  if (!url) throw new Error("Database URL is not configured");
  return url;
}

let _db: ReturnType<typeof createDb> | null = null;

function createDb() {
  const pool = new Pool({
    connectionString: getDatabaseUrl(),
    max: 10,
  });
  return drizzle(pool, { schema });
}

export function getDb() {
  if (!_db) {
    _db = createDb();
  }
  return _db;
}

export type Db = ReturnType<typeof getDb>;
