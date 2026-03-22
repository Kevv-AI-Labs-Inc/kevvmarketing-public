const DIRECT_DATABASE_URL_KEYS = [
  "DATABASE_URL",
  "DATABASE_PRIVATE_URL",
  "POSTGRES_URL",
  "POSTGRESQL_URL",
  "PGDATABASE_URL",
] as const;

type EnvLike = Record<string, string | undefined>;

function readFirstNonEmpty(env: EnvLike, keys: readonly string[]): string | null {
  for (const key of keys) {
    const value = env[key];
    if (value && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function buildFromParts(env: EnvLike): string | null {
  const host = readFirstNonEmpty(env, ["PGHOST", "POSTGRES_HOST"]);
  if (!host) return null;

  const port = readFirstNonEmpty(env, ["PGPORT", "POSTGRES_PORT"]) ?? "5432";
  const database = readFirstNonEmpty(env, ["PGDATABASE", "POSTGRES_DB", "POSTGRES_DATABASE"]) ?? "postgres";
  const user = readFirstNonEmpty(env, ["PGUSER", "POSTGRES_USER"]);
  const password = readFirstNonEmpty(env, ["PGPASSWORD", "POSTGRES_PASSWORD"]);

  const auth =
    user && password
      ? `${encodeURIComponent(user)}:${encodeURIComponent(password)}@`
      : user
        ? `${encodeURIComponent(user)}@`
        : "";

  return `postgresql://${auth}${host}:${port}/${encodeURIComponent(database)}`;
}

export function resolveDatabaseUrl(env: EnvLike = process.env): string | null {
  const direct = readFirstNonEmpty(env, DIRECT_DATABASE_URL_KEYS);
  if (direct) return direct;

  return buildFromParts(env);
}
