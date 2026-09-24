/**
 * Moves every uploaded file out of Postgres and onto the filesystem.
 *
 *   bun scripts/files/move-to-disk.ts --dry-run   plan it, write nothing
 *   bun scripts/files/move-to-disk.ts             move them
 *
 * The bytes used to be base64 TEXT chunks in `applicant_file` (CVs, profile
 * photos) and `news_media` (news covers). This walks those rows, writes each
 * file into the content-addressed store under `UPLOAD_DIR`, and records the
 * metadata in `stored_file`. After it runs, the readers stop falling back to
 * the chunks because every file has a row.
 *
 * It never deletes a chunk row. Dropping the old copy is a separate change,
 * made once someone has looked at the result and agreed the files are there —
 * until then the chunks are the backup, and the fallback reads in
 * `src/server/applicant/account-store.ts` and `src/server/news/store.ts` mean
 * a half-finished run serves every file either way.
 *
 * Idempotent. A file that already has a `stored_file` row is skipped, so a
 * re-run after an interrupted one finishes the job and changes nothing else.
 * Writing a blob is idempotent on its own too: the name is the digest, so a
 * second write of the same bytes is a no-op.
 *
 * The planning — which rows are which file, what is already done — is
 * `src/server/files/move-plan.ts`, a pure function with its own unit tests.
 * This file is only I/O.
 *
 * Needs `DATABASE_URL` (Bun loads `.env.local` itself) and, in production,
 * `UPLOAD_DIR`. Run it as the user the web server runs as, or `chown` the
 * store afterwards — files it creates are owned by whoever ran it.
 */
import { and, asc, eq } from "drizzle-orm";

import { parseDataUrl } from "../../src/server/files/data-url";
import { type MoveItem, ownerId, planMove } from "../../src/server/files/move-plan";
import { putBlob, uploadRoot } from "../../src/server/files/store";
import { applicantFile, newsMedia, storedFile } from "../../src/lib/db/schema";
import { openDb, type ScriptDb } from "../db/client";

const args = new Set(process.argv.slice(2));
const dryRun = args.has("--dry-run");
for (const arg of args) {
  if (arg !== "--dry-run") {
    console.error(`Unknown argument: ${arg}`);
    console.error("Usage: bun scripts/files/move-to-disk.ts [--dry-run]");
    process.exit(2);
  }
}

type Db = ScriptDb["db"];

/** Fresh id per row, in the same shape `src/server/files/records.ts` writes. */
function newId(): string {
  return `fil_${crypto.randomUUID().replaceAll("-", "").slice(0, 12)}`;
}

/**
 * The base64 payload of one legacy file, chunks rejoined in order.
 *
 * This is the one place the old memory cost is unavoidable — the whole file
 * does come through Postgres and into this process, which is exactly what the
 * app no longer does. A script run once, by hand, can afford it; a request
 * serving a page could not.
 */
async function readChunks(db: Db, item: MoveItem): Promise<string | null> {
  if (item.ownerKind === "news_media") {
    const rows = await db
      .select({ data: newsMedia.data })
      .from(newsMedia)
      .where(eq(newsMedia.key, item.ownerKey))
      .orderBy(asc(newsMedia.chunkIndex));
    return rows.length > 0 ? rows.map((row) => row.data).join("") : null;
  }

  const kind = item.ownerKind === "applicant_cv" ? "cv" : "picture";
  const rows = await db
    .select({ data: applicantFile.data })
    .from(applicantFile)
    .where(and(eq(applicantFile.email, item.ownerKey), eq(applicantFile.kind, kind)))
    .orderBy(asc(applicantFile.chunkIndex));
  return rows.length > 0 ? rows.map((row) => row.data).join("") : null;
}

/**
 * Writes one file and records it. Returns the bytes written, or null if the
 * row turned out to hold nothing readable.
 *
 * A photo is a whole `data:` URL, so its payload and its content type are both
 * inside the stored string; the planner leaves `contentType` null to say so.
 */
async function moveOne(db: Db, item: MoveItem): Promise<number | null> {
  const stored = await readChunks(db, item);
  if (stored === null) return null;

  const parsed = item.contentType === null ? parseDataUrl(stored) : null;
  const base64 = parsed ? parsed.base64 : stored;
  const contentType = item.contentType ?? parsed!.contentType;

  const bytes = Buffer.from(base64, "base64");
  const { sha256, byteSize } = await putBlob(bytes);

  // Blob first, row second — the same order as the app's own writer, so a
  // crash between them leaves an unreferenced file rather than a row that
  // names one that is not there. `DO NOTHING` makes a re-run harmless if the
  // row appeared between the plan and now (an applicant uploading mid-run).
  await db
    .insert(storedFile)
    .values({
      id: newId(),
      sha256,
      contentType,
      byteSize,
      ownerKind: item.ownerKind,
      ownerKey: item.ownerKey,
      filename: item.filename,
      createdAt: new Date(),
    })
    .onConflictDoNothing();

  return byteSize;
}

async function main(): Promise<void> {
  const handle = openDb();
  const db = handle.db;

  try {
    const [applicantFiles, media, already] = await Promise.all([
      db
        .select({
          email: applicantFile.email,
          kind: applicantFile.kind,
          filename: applicantFile.filename,
        })
        .from(applicantFile),
      db.select({ key: newsMedia.key, contentType: newsMedia.contentType }).from(newsMedia),
      db
        .select({ ownerKind: storedFile.ownerKind, ownerKey: storedFile.ownerKey })
        .from(storedFile),
    ]);

    const plan = planMove({
      applicantFiles,
      newsMedia: media,
      alreadyStored: already.map((row) =>
        ownerId(row.ownerKind as MoveItem["ownerKind"], row.ownerKey),
      ),
    });

    console.log(`store: ${uploadRoot()}`);
    console.log(
      `applicant_file: ${plan.counts.applicantChunks} chunk row(s); ` +
        `news_media: ${plan.counts.newsMediaChunks} chunk row(s)`,
    );
    console.log(
      `${plan.counts.files} file(s): ${plan.counts.move} to move, ` +
        `${plan.counts.skipped} already stored`,
    );

    if (dryRun) {
      for (const item of plan.move) console.log(`  would move ${ownerId(item.ownerKind, item.ownerKey)}`);
      console.log("\n--dry-run: nothing was written.");
      return;
    }

    let moved = 0;
    let empty = 0;
    let bytes = 0;
    let failed = 0;

    for (const item of plan.move) {
      const id = ownerId(item.ownerKind, item.ownerKey);
      try {
        const size = await moveOne(db, item);
        if (size === null) {
          empty += 1;
          console.warn(`  ! ${id}: no chunk rows, skipped`);
          continue;
        }
        moved += 1;
        bytes += size;
        console.log(`  ✓ ${id} (${size} bytes) — ${moved}/${plan.counts.move}`);
      } catch (error) {
        // One bad file must not abandon the rest: the run is idempotent, so
        // the operator can fix the cause and run it again for the remainder.
        failed += 1;
        console.error(`  ✗ ${id}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    console.log(
      `\nmoved ${moved} file(s), ${bytes} byte(s); ` +
        `${plan.counts.skipped} already stored, ${empty} empty, ${failed} failed`,
    );
    console.log("The chunk rows are untouched — cleaning them up is a separate step.");
    if (failed > 0) process.exitCode = 1;
  } finally {
    await handle.close();
  }
}

await main();
