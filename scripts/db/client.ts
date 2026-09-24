/**
 * A Drizzle client over `DATABASE_URL` for one-off `bun` scripts.
 *
 * Not `src/lib/db`: that module imports `server-only`, which throws outside a
 * React Server build. Same driver, same schema, same connection options
 * (`src/lib/db/url.ts`) — only the caching-on-globalThis is left out, because
 * a script connects once and exits. Bun loads `.env.local` itself.
 */
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "../../src/lib/db/schema";
import { poolConfig } from "../../src/lib/db/url";

export type ScriptDb = {
  db: NodePgDatabase<typeof schema>;
  pool: Pool;
  close: () => Promise<void>;
};

export function openDb(): ScriptDb {
  // One connection: a script is sequential, and a small pool left open is the
  // usual reason a `bun scripts/...` run hangs instead of exiting.
  const pool = new Pool({ ...poolConfig(), max: 1 });
  return { db: drizzle(pool, { schema }), pool, close: () => pool.end() };
}

export { schema };
