import { randomBytes } from "node:crypto";

import { and, eq } from "drizzle-orm";

import { getDb, storedFile } from "@/lib/db";
import { deleteBlob, putBlob, readBlob } from "./store";

/**
 * The join between an owner and its bytes: `stored_file` rows on one side,
 * the content-addressed files of `./store` on the other.
 *
 * Kept separate from `./store` because the store must stay database-free — the
 * migration script runs it outside a Next build, where `@/lib/db`'s
 * `server-only` import throws.
 *
 * Every function here is "the current file for this owner". There is no
 * history: an owner has one file, replacing it replaces the row, and the
 * previous bytes are collected if nothing else names them.
 */

/**
 * Who owns a stored file. The value is written into `stored_file.owner_kind`,
 * so these strings are data and must not be renamed casually.
 */
export type OwnerKind = "applicant_cv" | "applicant_picture" | "news_media";

export type OwnedFile = {
  sha256: string;
  contentType: string;
  byteSize: number;
  filename: string | null;
  bytes: Buffer;
};

function newId(): string {
  return `fil_${randomBytes(6).toString("hex")}`;
}

function owner(kind: OwnerKind, key: string) {
  return and(eq(storedFile.ownerKind, kind), eq(storedFile.ownerKey, key));
}

/**
 * The current file for an owner, bytes included, or null.
 *
 * A row whose blob is missing answers null rather than throwing. It reads as
 * "not stored here", which sends the caller to its legacy-chunk fallback — the
 * right answer while the migration is half done, and a 404 rather than a 500
 * afterwards.
 */
export async function readOwnedFile(kind: OwnerKind, key: string): Promise<OwnedFile | null> {
  if (!key) return null;

  const [row] = await getDb().select().from(storedFile).where(owner(kind, key)).limit(1);
  if (!row) return null;

  const bytes = await readBlob(row.sha256);
  if (!bytes) return null;

  return {
    sha256: row.sha256,
    contentType: row.contentType,
    byteSize: row.byteSize,
    filename: row.filename,
    bytes,
  };
}

/** The current file's metadata, without opening it — the size/type of a HEAD-shaped read. */
export async function statOwnedFile(kind: OwnerKind, key: string) {
  if (!key) return null;
  const [row] = await getDb().select().from(storedFile).where(owner(kind, key)).limit(1);
  return row ?? null;
}

export type PutOwnedFile = {
  ownerKind: OwnerKind;
  ownerKey: string;
  bytes: Uint8Array;
  contentType: string;
  filename?: string | null;
};

/**
 * Stores bytes and points an owner at them, replacing whatever it pointed at.
 *
 * Bytes first, row second, old bytes last. The order matters: writing the blob
 * before the row means a crash in between leaves an unreferenced file (wasted
 * space, collected later) instead of a row naming a file that is not there —
 * which is a broken download on a live page. It is the same rule the newsroom
 * store already follows for cover swaps.
 */
export async function putOwnedFile(input: PutOwnedFile): Promise<OwnedFile> {
  const { ownerKind, ownerKey, bytes, contentType } = input;
  const filename = input.filename ?? null;

  const { sha256, byteSize } = await putBlob(bytes);

  const previous = await statOwnedFile(ownerKind, ownerKey);
  const db = getDb();
  if (previous) await db.delete(storedFile).where(owner(ownerKind, ownerKey));
  await db.insert(storedFile).values({
    id: newId(),
    sha256,
    contentType,
    byteSize,
    ownerKind,
    ownerKey,
    filename,
    createdAt: new Date(),
  });

  // Only now, and only if the replacement really is different content — a
  // re-upload of the same file resolves to the same address, and collecting
  // "the old one" there would delete the bytes just written.
  if (previous && previous.sha256 !== sha256) await collectBlob(previous.sha256);

  return { sha256, contentType, byteSize, filename, bytes: Buffer.from(bytes) };
}

/** Forgets an owner's file, and its bytes if no other owner shares them. */
export async function dropOwnedFile(kind: OwnerKind, key: string): Promise<void> {
  if (!key) return;
  const existing = await statOwnedFile(kind, key);
  if (!existing) return;

  await getDb().delete(storedFile).where(owner(kind, key));
  await collectBlob(existing.sha256);
}

/**
 * Removes bytes that no row names any more.
 *
 * Content addressing means blobs are shared — the same logo on two stories, a
 * blank-page PDF uploaded by two applicants — so "this owner is done with it"
 * is not "nobody needs it". Failure is swallowed: an orphan on disk is a
 * housekeeping problem, never a reason to fail the delete the user asked for.
 */
async function collectBlob(sha256: string): Promise<void> {
  try {
    const rows = await getDb()
      .select({ id: storedFile.id })
      .from(storedFile)
      .where(eq(storedFile.sha256, sha256))
      .limit(1);
    if (rows.length === 0) await deleteBlob(sha256);
  } catch (error) {
    console.error("[files] could not collect blob", sha256, error);
  }
}
