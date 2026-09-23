/**
 * Writes the owner's nine articles into D1 and retires the placeholders.
 *
 *   bun scripts/news/sync.ts --dry-run     print the plan and its SQL, write nothing
 *   bun scripts/news/sync.ts               insert the articles D1 does not have yet
 *   bun scripts/news/sync.ts --force       …and overwrite the ones it does
 *
 * The database is shared with production — localhost and the live site read
 * and write the same rows — so every write here is a production write. The
 * script is built to be safe to re-run:
 *
 * - it never deletes. The seven placeholder rows are set to `draft` (and off
 *   the lead slot), which takes them off the site and keeps them on the desk;
 * - a row that already exists is left alone unless `--force` is passed, so a
 *   correction an editor made in `/admin/news` survives the next run;
 * - a slug already held by some other row is reported and skipped rather than
 *   failing the run halfway.
 *
 * `--dry-run` still *reads* D1 (one SELECT) so the plan can say which rows
 * would be inserted and which overwritten. Without credentials it plans as if
 * the table were empty, and says so.
 *
 * What gets written is decided in `src/server/news/seed.ts` (the rows) and
 * `src/server/news/sync-plan.ts` (the statements); this file only does I/O.
 * Bun loads `.env.local` by itself.
 */
import { PLACEHOLDER_IDS, seedArticles } from "../../src/server/news/seed";
import { type ExistingRow, planSync } from "../../src/server/news/sync-plan";

import { d1, rowsOf } from "./d1-http";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
const force = args.has("--force");

for (const arg of args) {
  if (arg !== "--dry-run" && arg !== "--force") {
    console.error(`Unknown argument: ${arg}`);
    process.exit(2);
  }
}

const hasCredentials = Boolean(
  process.env.CLOUDFLARE_ACCOUNT_ID &&
    process.env.CLOUDFLARE_DATABASE_ID &&
    process.env.CLOUDFLARE_D1_TOKEN,
);

async function readExisting(): Promise<ExistingRow[]> {
  if (!hasCredentials && dryRun) {
    console.log("! No D1 credentials: planning against an empty table.");
    return [];
  }
  return rowsOf(await d1("SELECT id, slug, status, featured FROM news_article")).map((row) => ({
    id: String(row.id),
    slug: String(row.slug),
    status: String(row.status),
    featured: Number(row.featured),
  }));
}

/** Long values (a body is kilobytes of JSON) shortened for the log only. */
function show(value: unknown): string {
  const text = JSON.stringify(value);
  return text.length > 100 ? `${text.slice(0, 97)}…"` : text;
}

const articles = seedArticles();
const existing = await readExisting();
const plan = planSync({
  articles,
  existing,
  placeholderIds: PLACEHOLDER_IDS,
  force,
  now: new Date().toISOString(),
});

console.log(`news_article rows now: ${existing.length}`);
console.log(`mode: ${dryRun ? "dry run" : "write"}${force ? " --force" : ""}`);
console.log(`insert    (${plan.inserted.length}): ${plan.inserted.join(", ") || "—"}`);
console.log(`overwrite (${plan.updated.length}): ${plan.updated.join(", ") || "—"}`);
console.log(`keep      (${plan.kept.length}): ${plan.kept.join(", ") || "—"}`);
console.log(`draft     (${plan.drafted.length}): ${plan.drafted.join(", ") || "—"}`);
if (plan.blocked.length > 0) {
  console.log(`! slug taken by another row, skipped: ${plan.blocked.join(", ")}`);
}
if (plan.kept.length > 0 && !force) {
  console.log("  (existing rows are only overwritten with --force)");
}
console.log("");

for (const statement of plan.statements) {
  console.log(`-- ${statement.note}`);
  console.log(`${statement.sql};`);
  console.log(`-- params: [${statement.params.map(show).join(", ")}]`);

  if (!dryRun) {
    const result = await d1(statement.sql, statement.params);
    const meta = result.result?.[0]?.meta ?? {};
    console.log(`-- → changes=${meta.changes ?? "?"}`);
  }
  console.log("");
}

if (dryRun) {
  console.log(`Dry run: ${plan.statements.length} statement(s) printed, nothing written.`);
} else {
  const after = rowsOf(
    await d1("SELECT status, COUNT(*) AS n FROM news_article GROUP BY status ORDER BY status"),
  );
  console.log(`Done. rows by status: ${after.map((row) => `${row.status}=${row.n}`).join(", ")}`);
}
