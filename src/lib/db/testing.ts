/**
 * A real PostgreSQL for unit tests, in process.
 *
 * The app's database is the customer's PostgreSQL server, which no test may
 * reach — and this machine has neither Docker nor a local Postgres. PGlite is
 * Postgres itself compiled to WASM, so the tests below still execute the SQL
 * Drizzle generates against the schema the committed migration creates: the
 * `jsonb` body, the `boolean`, the timestamps and every unique index are the
 * real ones, not a hand-rolled fake.
 *
 * The driver is `drizzle-orm/pg-proxy` rather than `drizzle-orm/pglite` for
 * one reason: the proxy hands each statement to a callback, which is where a
 * test can watch the SQL go past or make a chosen statement fail (a database
 * outage mid-save). Everything else is identical.
 *
 * Test-only, but it lives under `src/lib/db` rather than in a test file
 * because four test files share it. Nothing in the running app imports it.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { PGlite } from "@electric-sql/pglite";
import { drizzle, type PgRemoteDatabase } from "drizzle-orm/pg-proxy";

import * as schema from "./schema";

const MIGRATIONS_DIR = join(process.cwd(), "drizzle");

/** Every table the migration creates, in the order the files create them. */
const TABLES = [
  "app_user",
  "applicant_account",
  "applicant_file",
  "applicant_link",
  "applicant_profile",
  "application_log",
  "news_article",
  "news_media",
  "stored_file",
] as const;

/** The committed migrations, one statement per entry. */
export function migrationStatements(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((name) => name.endsWith(".sql"))
    .sort()
    .flatMap((name) => readFileSync(join(MIGRATIONS_DIR, name), "utf8").split("--> statement-breakpoint"))
    .map((statement) => statement.trim())
    .filter(Boolean);
}

export type TestDatabase = {
  client: PGlite;
  db: PgRemoteDatabase<typeof schema>;
  /** Empties every table — call it between tests instead of rebuilding Postgres. */
  reset: () => Promise<void>;
};

export type TestDatabaseHooks = {
  /** Called with every statement before it runs; throw to simulate an outage. */
  onQuery?: (sql: string) => void;
};

/**
 * A fresh in-memory Postgres with the migration applied.
 *
 * Booting PGlite costs a moment, so a test file builds one and calls `reset()`
 * between cases rather than building one per case.
 */
export async function createTestDatabase(hooks: TestDatabaseHooks = {}): Promise<TestDatabase> {
  const client = new PGlite();
  for (const statement of migrationStatements()) await client.exec(statement);

  const db = drizzle(
    async (sql, params) => {
      hooks.onQuery?.(sql);
      // Positional arrays out, as the pg-proxy driver expects; PGlite parses
      // values the same way node-postgres does (Date, boolean, parsed jsonb).
      const result = await client.query(sql, params as unknown[], { rowMode: "array" });
      return { rows: result.rows as unknown[][] };
    },
    { schema },
  );

  const reset = async () => {
    await client.exec(`TRUNCATE ${TABLES.map((t) => `"${t}"`).join(", ")} RESTART IDENTITY CASCADE`);
  };

  return { client, db, reset };
}
