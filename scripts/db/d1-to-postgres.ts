/**
 * Copies every row out of the old Cloudflare D1 database into PostgreSQL.
 *
 *   bun scripts/db/d1-to-postgres.ts --dry-run   count the rows, write nothing
 *   bun scripts/db/d1-to-postgres.ts             copy them
 *
 * Run it once, after `bun run db:push` (or `drizzle-kit migrate`) has created
 * the tables. It is safe to run again: every insert is `ON CONFLICT DO
 * NOTHING`, so a re-run after a half-finished copy fills in what is missing
 * and leaves what is there alone. It never updates and never deletes.
 *
 * D1 is read-only here. It still holds the customer's live data, and
 * `d1Select` (src/lib/d1/read.ts) refuses anything that is not a SELECT.
 *
 * This file is only the I/O: read a page, convert it, insert it. The
 * conversions — SQLite's epoch integers and 0/1 into `timestamptz` and
 * `boolean`, `body_json` TEXT into `jsonb` — live in `src/lib/db/d1-rows.ts`,
 * where they are unit-tested without either database.
 *
 * Reads are paged (D1 answers one query at a time and the two file tables hold
 * half-megabyte base64 chunks), and each table prints source and target counts
 * at the end so the operator can see the copy landed.
 *
 * Needs the D1 credentials and `DATABASE_URL` in the environment — `--dry-run`
 * needs `DATABASE_URL` only if you want the target side of the count. Bun
 * loads `.env.local` itself.
 */
import { sql } from "drizzle-orm";

import { d1Select } from "../../src/lib/d1/read";
import { D1_TABLES } from "../../src/lib/db/d1-rows";
import { openDb, type ScriptDb } from "./client";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
for (const arg of args) {
  if (arg !== "--dry-run") {
    console.error(`Unknown argument: ${arg}`);
    process.exit(2);
  }
}

async function sourceCount(name: string): Promise<number> {
  const rows = await d1Select(`SELECT COUNT(*) AS n FROM ${name}`);
  return Number(rows[0]?.n ?? 0);
}

async function targetCount(db: ScriptDb["db"], name: string): Promise<number> {
  // `::text`, because a Postgres COUNT is a bigint and the driver hands
  // bigints back as strings anyway — this way the cast is explicit.
  const result = await db.execute<{ n: string }>(
    sql.raw(`SELECT COUNT(*)::text AS n FROM "${name}"`),
  );
  return Number(result.rows[0]?.n ?? 0);
}

type Summary = { table: string; source: number; target: number | null; copied: number };

async function main(): Promise<void> {
  // A dry run without a connection string still counts the D1 side, which is
  // how it is useful before the customer's database exists.
  const handle = !dryRun || process.env.DATABASE_URL ? openDb() : null;
  const summaries: Summary[] = [];

  try {
    for (const spec of D1_TABLES) {
      const source = await sourceCount(spec.name);
      console.log(`${spec.name}: ${source} row(s) in D1`);

      let copied = 0;
      if (!dryRun && handle && source > 0) {
        for (let offset = 0; offset < source; offset += spec.pageSize) {
          const rows = await d1Select(
            `SELECT * FROM ${spec.name} ORDER BY ${spec.orderBy} LIMIT ${spec.pageSize} OFFSET ${offset}`,
          );
          if (rows.length === 0) break;
          const values = rows.map((row) => spec.convert(row));
          // ON CONFLICT DO NOTHING with no target: the primary key and every
          // unique index are all reasons to skip a row we already have.
          await handle.db.insert(spec.table).values(values).onConflictDoNothing();
          copied += values.length;
          console.log(`  … ${Math.min(offset + rows.length, source)}/${source}`);
        }
      }

      summaries.push({
        table: spec.name,
        source,
        target: handle ? await targetCount(handle.db, spec.name) : null,
        copied,
      });
    }
  } finally {
    await handle?.close();
  }

  console.log(dryRun ? "\nDry run — nothing was written.\n" : "\nDone.\n");
  console.log("table                  d1    postgres    read");
  for (const row of summaries) {
    const target = row.target === null ? "  (no DATABASE_URL)" : String(row.target).padStart(12);
    console.log(
      `${row.table.padEnd(20)}${String(row.source).padStart(4)}${target}${String(row.copied).padStart(8)}`,
    );
  }

  const short = summaries.filter((row) => row.target !== null && row.target < row.source);
  if (!dryRun && short.length > 0) {
    console.warn(
      `\n! Fewer rows in Postgres than in D1 for: ${short.map((row) => row.table).join(", ")}`,
    );
    process.exitCode = 1;
  }
}

await main();
