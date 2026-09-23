/**
 * Drizzle client over PostgreSQL (`pg` + `drizzle-orm/node-postgres`).
 * Server-only. The database is the customer's own Postgres on their internal
 * network; the connection string is `DATABASE_URL` in the server environment —
 * never `NEXT_PUBLIC_*`, because it carries the password.
 *
 * The exported surface is the one the D1 client had — `getDb()`, `schema` and
 * the schema re-exports — so callers did not have to change.
 *
 * The pool is parked on `globalThis` rather than in a module-level `let`:
 * `next dev` re-evaluates this module on every hot reload, and a fresh
 * `pg.Pool` per reload leaks its sockets until Postgres runs out of
 * connections. In production the module is evaluated once and this is simply a
 * module singleton.
 *
 * `DATABASE_URL` is read on first use, not at import time, so a missing one is
 * an error the first query reports rather than a build that fails to load.
 * SSL follows `?sslmode=` and is off by default — see `./url`.
 */
import "server-only";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";
import { poolConfig } from "./url";

type DbGlobal = typeof globalThis & {
  __shunhlaiPgPool?: Pool;
  __shunhlaiDb?: NodePgDatabase<typeof schema>;
};

const globalRef = globalThis as DbGlobal;

function getPool(): Pool {
  if (!globalRef.__shunhlaiPgPool) {
    const pool = new Pool(poolConfig());

    /**
     * An idle client that dies takes the process with it without this.
     *
     * `pg` re-emits a backend or socket error on the pool itself, and an
     * `error` event with no listener is how Node decides to throw. The errors
     * that reach here are the ones nobody is awaiting — Postgres restarting,
     * an idle connection cut by a firewall — none of which should end the
     * server. The pool discards the broken client and the next query opens a
     * fresh one, so logging is the whole job.
     */
    pool.on("error", (error) => {
      console.error("[db] idle client error", error);
    });

    globalRef.__shunhlaiPgPool = pool;
  }
  return globalRef.__shunhlaiPgPool;
}

export function getDb(): NodePgDatabase<typeof schema> {
  globalRef.__shunhlaiDb ??= drizzle(getPool(), { schema });
  return globalRef.__shunhlaiDb;
}

export { schema };
export * from "./schema";
