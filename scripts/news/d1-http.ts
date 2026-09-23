/**
 * The D1 HTTP query endpoint, for one-off bun scripts.
 *
 * Not `src/lib/db`: that module imports `server-only`, which throws outside a
 * React Server build. Same endpoint, same env (bun loads `.env.local` itself).
 *
 * The database is shared with production — every call here is a production
 * query. Keep scripts that use this additive.
 */

export type D1Result = {
  success: boolean;
  errors?: unknown[];
  result?: { results?: Record<string, unknown>[]; meta?: Record<string, unknown> }[];
};

export async function d1(sql: string, params: unknown[] = []): Promise<D1Result> {
  const account = process.env.CLOUDFLARE_ACCOUNT_ID;
  const database = process.env.CLOUDFLARE_DATABASE_ID;
  const token = process.env.CLOUDFLARE_D1_TOKEN;
  if (!account || !database || !token) {
    throw new Error(
      "Cloudflare D1 env missing: CLOUDFLARE_ACCOUNT_ID / CLOUDFLARE_DATABASE_ID / CLOUDFLARE_D1_TOKEN",
    );
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${account}/d1/database/${database}/query`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ sql, params }),
    },
  );
  const body = (await response.json()) as D1Result;
  if (!body.success) throw new Error(`D1 query failed: ${JSON.stringify(body.errors ?? body)}`);
  return body;
}

export function rowsOf(result: D1Result): Record<string, unknown>[] {
  return result.result?.[0]?.results ?? [];
}
