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

/** The connection string, or an error that says what to set and to what. */
export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Point it at the application's PostgreSQL " +
        "database; docs/postgres.md has the connection string to use for " +
        "local development and for the server.",
    );
  }
  return url;
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
