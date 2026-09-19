/**
 * Drizzle client over Cloudflare D1, via D1's HTTP query API (sqlite-proxy).
 * Server-only. Works under `next dev` (plain Node) using the account/database
 * id + token in the environment.
 *
 * Production note: when this app is deployed on Cloudflare (OpenNext), swap this
 * for the native binding — `import { drizzle } from "drizzle-orm/d1"` with the
 * `DB` binding from `getCloudflareContext()`. The schema and callers don't change.
 */
import "server-only";
import { drizzle, type SqliteRemoteDatabase } from "drizzle-orm/sqlite-proxy";
import * as schema from "./schema";

const D1_ENDPOINT = (account: string, database: string) =>
  `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${database}/query`;

async function d1Query(sql: string, params: unknown[]): Promise<Record<string, unknown>[]> {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const database = process.env.CLOUDFLARE_DATABASE_ID;
  const token = process.env.CLOUDFLARE_D1_TOKEN;
  if (!account || !database || !token) {
    throw new Error(
      "Cloudflare D1 env missing: CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_DATABASE_ID / CLOUDFLARE_D1_TOKEN"
    );
  }
  const res = await fetch(D1_ENDPOINT(account, database), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql, params }),
  });
  const body = (await res.json()) as {
    success: boolean;
    errors?: unknown;
    result?: { results?: Record<string, unknown>[] }[];
  };
  if (!body.success) {
    throw new Error(`D1 query failed: ${JSON.stringify(body.errors ?? body)}`);
  }
  return body.result?.[0]?.results ?? [];
}

let cached: SqliteRemoteDatabase<typeof schema> | null = null;

export function getDb(): SqliteRemoteDatabase<typeof schema> {
  if (cached) return cached;
  cached = drizzle(
    async (sql, params, method) => {
      const rows = await d1Query(sql, params);
      // sqlite-proxy wants positional arrays; D1 returns column-ordered objects.
      const arr = rows.map((r) => Object.values(r));
      return { rows: method === "get" ? arr[0] ?? [] : arr };
    },
    { schema }
  );
  return cached;
}

export { schema };
export * from "./schema";
