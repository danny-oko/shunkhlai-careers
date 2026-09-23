import { createHash, randomBytes } from "node:crypto";
import { mkdir, open, readFile, rename, rm, stat } from "node:fs/promises";
import { isAbsolute, join, relative, resolve } from "node:path";

/**
 * Content-addressed file storage on the filesystem.
 *
 * The bytes of every uploaded file — applicant CVs, profile photos, news
 * covers — used to live in Postgres as chunked base64 TEXT. That is the wrong
 * place for megabytes: base64 inflates them by a third, every read pulls the
 * whole file through the database into Node's heap, and `pg_dump` carries all
 * of it. The customer's server has 1.9 GB of RAM, so the bytes move here and
 * only the metadata stays in Postgres (`stored_file`).
 *
 * A file is named by the SHA-256 of its own contents, so:
 *
 * - identical uploads (the same company logo on ten stories) cost one file;
 * - a name can never be reused for different bytes, which is what makes the
 *   `immutable` cache header on `/api/news/media/*` honest;
 * - nothing a caller supplies is ever part of a path — see `blobPath`.
 *
 * The digest is fanned out two bytes at a time (`ab/cd/abcd…`). One flat
 * directory with tens of thousands of entries is slow to list and, on ext4
 * without `dir_index`, slow to open a file in; 256 × 256 buckets keeps every
 * directory small for far more files than this site will ever hold.
 *
 * This module is deliberately free of `server-only` and of any database
 * import: the one-off migration script (`scripts/files/move-to-disk.ts`) runs
 * it under plain `bun`, outside a React Server build.
 *
 * Every filesystem call below carries a `turbopackIgnore` comment. Turbopack
 * traces static filesystem access so it can bundle the files a route reads,
 * and a path it cannot follow makes it trace the whole project — which would
 * copy every source file *and `public/`* into the server output. There is
 * nothing here for it to bundle: the store is a runtime directory outside the
 * build, named by an environment variable the build does not see, and its
 * contents are the customer's uploads rather than anything shipped.
 */

/** The production default — a data directory, not anything the web server serves. */
const DEFAULT_UPLOAD_DIR = "/var/lib/shunhlai/uploads";

/**
 * Development writes into the checkout instead, so a `bun run dev` on a laptop
 * needs no root-owned directory. It is `.file-store/`, never `public/`:
 * anything under `public/` is served verbatim by Next, which would hand out
 * every applicant's CV to anyone who could guess a digest, and the access
 * checks in `/api/me` would be decoration.
 */
const DEV_UPLOAD_DIR = ".file-store";

/** Where an in-progress write lives until it is complete — see `putBlob`. */
const TEMP_DIR = ".tmp";

/** A SHA-256 as this module writes it: 64 lowercase hex digits, nothing else. */
const DIGEST_PATTERN = /^[0-9a-f]{64}$/;

/**
 * Read per call rather than captured at import: tests point `UPLOAD_DIR` at a
 * temp directory, and the module may already be loaded when they do.
 */
export function uploadRoot(): string {
  const configured = process.env.UPLOAD_DIR?.trim();
  if (configured) return resolve(configured);
  if (process.env.NODE_ENV === "production") return DEFAULT_UPLOAD_DIR;
  return resolve(process.cwd(), DEV_UPLOAD_DIR);
}

/**
 * The path a digest names, or null if the argument is not a digest.
 *
 * This is the only place a string out of the database becomes a filesystem
 * path, so the check is explicit rather than implied by the caller — the same
 * shape as `readSeedMedia` in `src/server/news/store.ts`. The pattern alone
 * already rejects `..`, a separator, an absolute path and an embedded NUL,
 * because none of those are hex; the containment check after it is the
 * belt-and-braces that survives someone loosening the pattern later.
 */
export function blobPath(digest: string): string | null {
  if (!DIGEST_PATTERN.test(digest)) return null;

  const root = uploadRoot();
  const path = resolve(root, digest.slice(0, 2), digest.slice(2, 4), digest);

  const inside = relative(root, path);
  if (!inside || inside.startsWith("..") || isAbsolute(inside)) return null;
  if (resolve(root, inside) !== path) return null;

  return path;
}

export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

export type StoredBlob = { sha256: string; byteSize: number };

/**
 * Writes bytes and returns the digest that names them.
 *
 * Atomic, because a half-written file under a content address is a lie that
 * never heals: the name says what the contents are, so a reader that found a
 * truncated one would cache it forever. The bytes go to a temp file in the
 * store's own `.tmp/` (same filesystem, so the rename below is a rename and
 * not a copy), are flushed to disk with `fsync`, and only then take their
 * final name. `rename(2)` is atomic, so a reader sees either no file or the
 * whole file — never a prefix of one — even if the process dies mid-write.
 *
 * Identical content is written once: if the name already exists the bytes are
 * already there, by definition of the address, so the temp file is discarded.
 */
export async function putBlob(bytes: Uint8Array): Promise<StoredBlob> {
  const digest = sha256Hex(bytes);
  const path = blobPath(digest);
  // Unreachable — `digest` comes from `createHash` — but the types say the
  // path is optional and a silent `!` here would be the wrong kind of quiet.
  if (!path) throw new Error("files: could not resolve a path for a fresh digest");

  const result: StoredBlob = { sha256: digest, byteSize: bytes.byteLength };
  if (await exists(path)) return result;

  const root = uploadRoot();
  const tempDir = join(root, TEMP_DIR);
  await mkdir(/*turbopackIgnore: true*/ tempDir, { recursive: true });
  const tempPath = join(tempDir, `${randomBytes(16).toString("hex")}.tmp`);

  try {
    const handle = await open(/*turbopackIgnore: true*/ tempPath, "w");
    try {
      await handle.writeFile(bytes);
      // Without this the rename can publish a name whose contents are still
      // only in the page cache: a power cut then leaves a zero-length file
      // under a digest that promises otherwise.
      await handle.sync();
    } finally {
      await handle.close();
    }

    // The ignore comment sits on `join` rather than on `mkdir`: it is the
    // path expression Turbopack tries to follow, and the two digest slices
    // are what it cannot resolve at build time.
    const bucket = join(/*turbopackIgnore: true*/ root, digest.slice(0, 2), digest.slice(2, 4));
    await mkdir(bucket, { recursive: true });
    await rename(/*turbopackIgnore: true*/ tempPath, path);
  } catch (error) {
    // Best effort: a leftover temp file is harmless (nothing reads `.tmp/`),
    // but there is no reason to keep it.
    await rm(/*turbopackIgnore: true*/ tempPath, { force: true }).catch(() => {});
    throw error;
  }

  return result;
}

/** The bytes a digest names, or null — an unknown digest is not an error. */
export async function readBlob(digest: string): Promise<Buffer | null> {
  const path = blobPath(digest);
  if (!path) return null;
  try {
    return await readFile(/*turbopackIgnore: true*/ path);
  } catch {
    return null;
  }
}

/** Whether a digest's bytes are on disk. */
export async function hasBlob(digest: string): Promise<boolean> {
  const path = blobPath(digest);
  return path ? exists(path) : false;
}

/**
 * Removes a digest's bytes.
 *
 * Callers must have established that nothing points at them any more — the
 * address is shared, so two applicants who upload the same file share one
 * blob. `dropOwnedFile` in `./records` does that check against `stored_file`;
 * nothing else should call this.
 */
export async function deleteBlob(digest: string): Promise<boolean> {
  const path = blobPath(digest);
  if (!path) return false;
  try {
    await rm(/*turbopackIgnore: true*/ path, { force: true });
    return true;
  } catch {
    return false;
  }
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(/*turbopackIgnore: true*/ path);
    return true;
  } catch {
    return false;
  }
}
