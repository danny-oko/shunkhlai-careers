import { mimeFromName } from "@/lib/file-type";
import type { OwnerKind } from "./records";

/**
 * What `scripts/files/move-to-disk.ts` is going to do, worked out before it
 * touches anything.
 *
 * Split out of the script and kept pure so it can be unit-tested without a
 * database and without a filesystem: the script is then only I/O — read the
 * chunks this says to read, write them, insert the row. It is also where
 * idempotence lives. A second run plans nothing, because everything already
 * has a `stored_file` row.
 *
 * No `@/lib/db` import: the script runs under plain `bun`, outside a Next
 * build, where `server-only` throws.
 */

/** One `applicant_file` row, as the planner needs it — one per chunk, any order. */
export type ApplicantChunk = {
  email: string;
  kind: string;
  filename: string | null;
};

/** One `news_media` row, likewise one per chunk. */
export type NewsMediaChunk = {
  key: string;
  contentType: string;
};

export type MoveItem = {
  ownerKind: OwnerKind;
  ownerKey: string;
  filename: string | null;
  /**
   * The type to record, or null when only the bytes can say.
   *
   * A profile photo is stored as a whole `data:` URL, so its type is in the
   * payload the script is about to read; a CV's comes from its filename, the
   * same way `/api/me/cv` has always answered it; a cover's is a column.
   */
  contentType: string | null;
};

export type MovePlan = {
  /** Files to write, in a stable order so two runs log the same sequence. */
  move: MoveItem[];
  /** Files already on disk — a re-run, or a file re-uploaded since the last one. */
  skipped: MoveItem[];
  counts: {
    applicantChunks: number;
    newsMediaChunks: number;
    files: number;
    move: number;
    skipped: number;
  };
};

export type PlanInput = {
  applicantFiles: ApplicantChunk[];
  newsMedia: NewsMediaChunk[];
  /** `stored_file` rows that already exist, as `ownerKind:ownerKey`. */
  alreadyStored: Iterable<string>;
};

/** The kinds `applicant_file.kind` may hold, mapped to who owns them. */
const APPLICANT_KINDS: Readonly<Record<string, OwnerKind>> = {
  cv: "applicant_cv",
  picture: "applicant_picture",
};

export function ownerId(kind: OwnerKind, key: string): string {
  return `${kind}:${key}`;
}

/**
 * Collapses chunk rows into one item per file, drops what is already moved.
 *
 * A file is many rows (half-megabyte base64 slices), and only the first
 * carries the CV's filename — so the first non-empty filename seen for an
 * owner wins, and the rest of the rows only count towards the total. Rows with
 * an unrecognised `kind` are left alone rather than guessed at; they would be
 * data this app did not write.
 */
export function planMove(input: PlanInput): MovePlan {
  const stored = new Set(input.alreadyStored);
  const files = new Map<string, MoveItem>();

  for (const chunk of input.applicantFiles) {
    const ownerKind = APPLICANT_KINDS[chunk.kind];
    if (!ownerKind || !chunk.email) continue;

    const id = ownerId(ownerKind, chunk.email);
    const existing = files.get(id);
    if (existing) {
      // A later chunk may be the one carrying the name (row order is not ours).
      if (!existing.filename && chunk.filename) {
        existing.filename = chunk.filename;
        existing.contentType = contentTypeFor(ownerKind, chunk.filename);
      }
      continue;
    }

    files.set(id, {
      ownerKind,
      ownerKey: chunk.email,
      filename: chunk.filename,
      contentType: contentTypeFor(ownerKind, chunk.filename),
    });
  }

  for (const chunk of input.newsMedia) {
    if (!chunk.key) continue;
    const id = ownerId("news_media", chunk.key);
    if (files.has(id)) continue;
    files.set(id, {
      ownerKind: "news_media",
      ownerKey: chunk.key,
      filename: null,
      contentType: chunk.contentType || null,
    });
  }

  const all = [...files.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const move: MoveItem[] = [];
  const skipped: MoveItem[] = [];
  for (const [id, item] of all) (stored.has(id) ? skipped : move).push(item);

  return {
    move,
    skipped,
    counts: {
      applicantChunks: input.applicantFiles.length,
      newsMediaChunks: input.newsMedia.length,
      files: all.length,
      move: move.length,
      skipped: skipped.length,
    },
  };
}

/** A photo's type is in its payload; a CV's is its extension's. */
function contentTypeFor(ownerKind: OwnerKind, filename: string | null): string | null {
  if (ownerKind !== "applicant_cv") return null;
  return mimeFromName(filename);
}
