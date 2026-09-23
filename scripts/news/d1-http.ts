/**
 * The D1 HTTP query endpoint, for one-off bun scripts.
 *
 * HISTORICAL: the app runs on PostgreSQL now (`src/lib/db`), and D1 is the old
 * database this port reads out of once — see `scripts/db/d1-to-postgres.ts`.
 * `scripts/news/sync.ts` still speaks to D1 through this module and its SQLite
 * SQL; it is kept as the record of how the newsroom rows were laid down, and
 * it is not part of the Postgres story.
 *
 * Not `src/lib/db`: that module imports `server-only`, which throws outside a
 * React Server build. The fetch itself lives in `src/lib/d1/read.ts`, which is
 * read-only and unit-tested; `d1()` below is the older, write-capable shape
 * `sync.ts` was built on.
 */
import { d1Credentials, type D1Body } from "../../src/lib/d1/read";

export type D1Result = {
  success: boolean;
  errors?: unknown[];
  result?: { results?: Record<string, unknown>[]; meta?: Record<string, unknown> }[];
};

export async function d1(sql: string, params: unknown[] = []): Promise<D1Result> {
  const { account, database, token } = d1Credentials();

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${database}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
    },
  );
  const body = (await response.json()) as D1Result & D1Body;
  if (!body.success) throw new Error(`D1 query failed: ${JSON.stringify(body.errors ?? body)}`);
  return body;
}

export function rowsOf(result: D1Result): Record<string, unknown>[] {
  return result.result?.[0]?.results ?? [];
}
