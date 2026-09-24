/**
 * Read-only client for the retired Cloudflare D1 database.
 *
 * The app itself runs on PostgreSQL now (`src/lib/db`). This module exists for
 * one job: `scripts/db/d1-to-postgres.ts` has to read the old rows out of D1
 * once so they can be loaded into the new database.
 *
 * Read-only on purpose. D1 still holds the customer's live data, and nothing
 * in this port should write to it — `d1Select` refuses anything that is not a
 * SELECT, so a typo in a migration script cannot become a production write.
 *
 * No `server-only` import: this runs under `bun scripts/...`, outside any
 * React build. Bun loads `.env.local` itself.
 */

export type D1Body = {
  success: boolean;
  errors?: unknown;
  result?: { results?: Record<string, unknown>[] }[];
};

/**
 * The rows out of a D1 HTTP response, or an error that says what happened.
 *
 * Read as text first: a gateway error or a rate limit comes back as HTML or
 * plain text, and `res.json()` on that threw "Unexpected token '<'", which
 * hid the HTTP status the caller needed to see.
 */
export async function readD1Response(res: Response): Promise<Record<string, unknown>[]> {
  const text = await res.text();
  let body: D1Body | null = null;
  try {
    body = JSON.parse(text) as D1Body;
  } catch {
    body = null;
  }
  if (!body || typeof body !== "object") {
    throw new Error(`D1 query failed: HTTP ${res.status} ${text.slice(0, 200)}`);
  }
  if (!body.success || !res.ok) {
    throw new Error(`D1 query failed: HTTP ${res.status} ${JSON.stringify(body.errors ?? body)}`);
  }
  return body.result?.[0]?.results ?? [];
}

/** True for a single read statement, and nothing else. */
export function isReadOnlySql(sql: string): boolean {
  const trimmed = sql.trim().replace(/;\s*$/u, "");
  if (trimmed.includes(";")) return false; // no statement stacking
  return /^(select|with)\b/iu.test(trimmed);
}

export type D1Credentials = { account: string; database: string; token: string };

export function d1Credentials(): D1Credentials {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const database = process.env.CLOUDFLARE_DATABASE_ID;
  const token = process.env.CLOUDFLARE_D1_TOKEN;
  if (!account || !database || !token) {
    throw new Error(
      "Cloudflare D1 env missing: CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_DATABASE_ID / CLOUDFLARE_D1_TOKEN",
    );
  }
  return { account, database, token };
}

/** Runs one SELECT against D1 over its HTTP query API and returns the rows. */
export async function d1Select(
  sql: string,
  params: unknown[] = [],
): Promise<Record<string, unknown>[]> {
  if (!isReadOnlySql(sql)) {
    throw new Error(`Refusing to run a non-SELECT statement against D1: ${sql.slice(0, 60)}`);
  }
  const { account, database, token } = d1Credentials();
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${database}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
    },
  );
  return readD1Response(res);
}
