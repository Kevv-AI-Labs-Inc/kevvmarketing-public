import { defineConfig } from "drizzle-kit";
import { resolveDatabaseUrl } from "./server/_core/database-url";

const connectionString = resolveDatabaseUrl();
if (!connectionString) {
  throw new Error(
    "Database URL is required for drizzle. Set DATABASE_URL (or PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE)."
  );
}

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
