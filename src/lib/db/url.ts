/**
 * How `DATABASE_URL` becomes `pg` connection options.
 *
 * Its own module, with no `server-only` import, because two very different
 * callers need it: the app's Drizzle client (`./index`) and the one-off `bun`
 * scripts under `scripts/db` and `scripts/users`, which run outside any React
 * build and would throw on `server-only`.
 */
import type { PoolConfig } from "pg";

/**
 * `sslmode` as libpq spells it, turned into what `pg` wants.
 *
 * TLS is off unless the URL asks for it: the customer's Postgres sits on their
 * internal network with no certificate. `require` and `prefer` mean "encrypt,
 * but do not check the certificate" — which is what a self-signed certificate
 * on an internal host needs; `verify-ca` / `verify-full` keep verification on.
 */
export function sslFromUrl(url: string): PoolConfig["ssl"] {
  let mode: string | null = null;
  try {
    const parsed = new URL(url);
    mode = parsed.searchParams.get("sslmode");
    if (!mode && parsed.searchParams.get("ssl") === "true") mode = "require";
  } catch {
    // Not a URL we can parse — let `pg` produce the connection error itself.
    return undefined;
  }
  if (!mode || mode === "disable") return undefined;
  if (mode === "verify-ca" || mode === "verify-full") return { rejectUnauthorized: true };
  return { rejectUnauthorized: false };
}

/**
 * Where the connection string may be found, in order of preference.
 *
 * `DATABASE_URL` is what this app documents and what a self-hosted deployment
 * sets. The `STORAGE_*` names are what Vercel's Neon integration wrote when it
 * was installed with a custom prefix, and `POSTGRES_URL` is what the same
 * integration writes without one — neither is worth a manual copy of a live
 * credential into a second variable, so they are read directly.
 *
 * The unpooled variants come last on purpose: they are the same database, but
 * bypass the connection pooler, and a serverless deployment wants the pooler.
 */
const URL_VARIABLES = [
  "DATABASE_URL",
  "STORAGE_DATABASE_URL",
  "POSTGRES_URL",
  "DATABASE_URL_UNPOOLED",
  "STORAGE_DATABASE_URL_UNPOOLED",
] as const;

/** The connection string, or an error that says what to set and to what. */
export function requireDatabaseUrl(): string {
  for (const name of URL_VARIABLES) {
    const value = process.env[name];
    if (value) return value;
  }

  throw new Error(
    `No database connection string. Set DATABASE_URL (or one of ${URL_VARIABLES.slice(1).join(", ")}) ` +
      "to the application's PostgreSQL database; docs/postgres.md has the " +
      "connection strings for local development and for the server.",
  );
}

/** Pool options for `DATABASE_URL`, shared by the app and the scripts. */
export function poolConfig(): PoolConfig {
  const url = requireDatabaseUrl();
  return {
    connectionString: url,
    ssl: sslFromUrl(url),
    // A Next.js server handles a handful of concurrent queries; a small pool
    // keeps well inside Postgres' default max_connections of 100 even with
    // several app instances.
    max: Number(process.env.DATABASE_POOL_MAX ?? 10),
  };
}
