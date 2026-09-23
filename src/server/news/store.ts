import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";

import { and, asc, eq, type SQL } from "drizzle-orm";

import { getDb, newsArticle, newsMedia, type NewsArticleRow } from "@/lib/db";
import { coerceBody } from "@/lib/news/legacy";
import type { RichDoc } from "@/lib/news/shared/rich-text";
import { uniqueSlug } from "@/lib/news/shared/slug";
import { dropOwnedFile, putOwnedFile, readOwnedFile } from "@/server/files/records";
import {
  NEWS_CATEGORIES,
  type NewsArticle,
  type NewsCategory,
  type NewsStatus,
  isUrlCoverKey,
} from "@/lib/news/types";

/**
 * Storage for the newsroom: `news_article` in PostgreSQL, through the same
 * Drizzle client as the applicant account, and cover bytes on the filesystem
 * (`src/server/files`). `news_media` is legacy — covers uploaded before that
 * move are still read from it until the migration script has moved them.
 *
 * This is also the boundary where the database's types become the app's. The
 * row now has a real `jsonb` body, a real `boolean` and real timestamps;
 * `NewsArticle` still promises a `RichDoc`, a `boolean` and ISO strings, and
 * `toArticle` / `toRow` below are the only two places that convert.
 *
 * The recruitment backend has no news endpoints, so this *is* the newsroom's
 * database. `service.ts` and the admin actions are the only callers; the
 * functions below are the whole surface the rest of the app knows.
 *
 * The database is shared by every host — localhost and production read and
 * write the same rows — so nothing here caches, and every read is a query.
 *
 * There is no seeding in here on purpose. The newsroom's stories are laid down
 * by `scripts/news/sync.ts`, a script a person runs; a store that re-seeded
 * whenever the table was empty would bring them back after an editor deleted
 * everything.
 */

export type ListQuery = {
  /** Public reads get published only; the admin desk asks for "all". */
  status?: NewsStatus | "all";
  category?: NewsCategory | null;
  search?: string;
  limit?: number;
};


/* --- ids ---------------------------------------------------------------- */

function newId(prefix: string, bytes: number): string {
  return `${prefix}${randomBytes(bytes).toString("hex")}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/* --- rows --------------------------------------------------------------- */

/**
 * `body_json` as a `RichDoc`, whatever it holds.
 *
 * Rows written before rich text store a `NewsBlock[]`; `coerceBody` reads
 * either shape (and sanitises the new one), so an old row renders without a
 * migration and is rewritten in the new shape the next time it is saved.
 *
 * The column is `jsonb`, so the driver hands back a parsed value — but a row
 * carried over from D1 may still hold JSON *as a string* (D1's column was
 * TEXT, and a migration that loaded it verbatim would produce a JSON string),
 * so a string is parsed once more before it is coerced.
 */
function parseBody(value: unknown): RichDoc {
  try {
    return coerceBody(typeof value === "string" ? JSON.parse(value) : value);
  } catch {
    // One corrupt row must not take the whole front page down with it.
    return coerceBody(null);
  }
}

function toArticle(row: NewsArticleRow): NewsArticle {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    lede: row.lede,
    category: row.category as NewsCategory,
    author: row.author,
    publishedAt: row.publishedAt,
    coverKey: row.coverKey ?? null,
    coverAlt: row.coverAlt,
    body: parseBody(row.bodyJson),
    status: row.status as NewsStatus,
    featured: row.featured,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toRow(article: NewsArticle): NewsArticleRow {
  const { body, createdAt, updatedAt, ...rest } = article;
  return {
    ...rest,
    bodyJson: body,
    createdAt: new Date(createdAt),
    updatedAt: new Date(updatedAt),
  };
}

/* --- reads -------------------------------------------------------------- */

/**
 * Newest first, with a featured story lifted above its date-mates.
 *
 * `publishedAt` is a plain `YYYY-MM-DD` string, so a lexical compare is also
 * the chronological one. `createdAt` breaks the remaining ties, which keeps the
 * order stable when an editor files two stories on the same day. Done in JS
 * rather than `ORDER BY` so the order does not depend on the database's
 * collation — the table is a few dozen rows.
 */
function compare(a: NewsArticle, b: NewsArticle): number {
  if (a.publishedAt !== b.publishedAt) return a.publishedAt < b.publishedAt ? 1 : -1;
  if (a.featured !== b.featured) return a.featured ? -1 : 1;
  return a.createdAt < b.createdAt ? 1 : -1;
}

/**
 * Case-folded in JS, not with SQL `ILIKE`: this began as a D1 table, where
 * SQLite folds ASCII only and every headline here is Cyrillic. Postgres would
 * fold it correctly, but the table is a few dozen rows and keeping the match
 * in one place keeps the result independent of the server's collation.
 */
function haystack(article: NewsArticle): string {
  return `${article.title} ${article.lede} ${article.author}`.toLowerCase();
}

export async function listArticles(query: ListQuery = {}): Promise<NewsArticle[]> {
  const status = query.status ?? "published";
  const search = (query.search ?? "").trim().toLowerCase();

  const where: SQL[] = [];
  if (status !== "all") where.push(eq(newsArticle.status, status));
  if (query.category) where.push(eq(newsArticle.category, query.category));

  const rows = (
    await getDb()
      .select()
      .from(newsArticle)
      .where(where.length > 0 ? and(...where) : undefined)
  )
    .map(toArticle)
    .filter((article) => !search || haystack(article).includes(search));

  rows.sort(compare);
  return typeof query.limit === "number" ? rows.slice(0, Math.max(0, query.limit)) : rows;
}

async function findOne(where: SQL): Promise<NewsArticle | null> {
  const rows = await getDb().select().from(newsArticle).where(where).limit(1);
  return rows[0] ? toArticle(rows[0]) : null;
}

export async function getArticleBySlug(slug: string): Promise<NewsArticle | null> {
  return findOne(eq(newsArticle.slug, slug));
}

export async function getArticleById(id: string): Promise<NewsArticle | null> {
  return findOne(eq(newsArticle.id, id));
}

/**
 * Counts for the category rail.
 *
 * Every category is present even at zero: the rail renders a fixed set of
 * links, and a missing key there would read as a missing section rather than
 * as an empty one.
 */
export async function countByCategory(
  status: NewsStatus | "all" = "published",
): Promise<Record<NewsCategory, number>> {
  const counts = Object.fromEntries(
    NEWS_CATEGORIES.map((category) => [category.value, 0]),
  ) as Record<NewsCategory, number>;

  const rows = await getDb()
    .select({ category: newsArticle.category })
    .from(newsArticle)
    .where(status === "all" ? undefined : eq(newsArticle.status, status));

  for (const { category } of rows) {
    if (category in counts) counts[category as NewsCategory] += 1;
  }

  return counts;
}

async function allSlugs(): Promise<string[]> {
  const rows = await getDb().select({ slug: newsArticle.slug }).from(newsArticle);
  return rows.map((row) => row.slug);
}

/* --- writes ------------------------------------------------------------- */

export type SaveInput = {
  /** Absent or null creates; an existing id updates in place. */
  id?: string | null;
  title: string;
  lede: string;
  category: NewsCategory;
  author: string;
  publishedAt: string;
  coverAlt: string;
  body: RichDoc;
  status: NewsStatus;
  featured: boolean;
  /**
   * Three states, and they are not the same: the key absent leaves the current
   * cover alone (the common case — an edit that does not touch the picture),
   * a string replaces it, and an explicit `null` removes it. The string is a
   * media key or an absolute https URL; the store treats both as opaque.
   */
  coverKey?: string | null;
};

export async function saveArticle(input: SaveInput): Promise<NewsArticle> {
  const existing = input.id ? await getArticleById(input.id) : null;
  const timestamp = nowIso();

  const fields = {
    title: input.title.trim(),
    lede: input.lede.trim(),
    category: input.category,
    author: input.author.trim(),
    publishedAt: input.publishedAt,
    coverAlt: input.coverAlt.trim(),
    body: input.body,
    status: input.status,
    featured: input.featured,
  };

  if (!existing) {
    const article: NewsArticle = {
      ...fields,
      id: newId("art_", 5),
      slug: uniqueSlug(fields.title, await allSlugs()),
      coverKey: input.coverKey ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    await getDb().insert(newsArticle).values(toRow(article));
    return article;
  }

  // A published URL is a promise. Re-slugging on every save would break every
  // link to the story the moment someone fixed a typo in the standfirst, so the
  // slug only moves when the headline itself does — and `keep` lets it stay put
  // when the new headline slugifies to the slug it already has.
  const slug =
    fields.title === existing.title
      ? existing.slug
      : uniqueSlug(fields.title, await allSlugs(), existing.slug);

  const coverKey = resolveCoverKey(existing, input);

  const updated: NewsArticle = {
    ...existing,
    ...fields,
    slug,
    coverKey,
    updatedAt: timestamp,
  };

  const { id, createdAt: _createdAt, ...changes } = toRow(updated);
  await getDb().update(newsArticle).set(changes).where(eq(newsArticle.id, id));

  // Only once the row points somewhere else. Dropping the old bytes first
  // meant a failed UPDATE left a story whose cover key named nothing — a
  // broken picture on a live page — where now it leaves, at worst, a few
  // orphaned chunks nobody links to.
  if (coverKey !== existing.coverKey) await dropMedia(existing.coverKey);
  return updated;
}

/** Applies the three-state `coverKey`: absent keeps, a string replaces, null removes. */
function resolveCoverKey(existing: NewsArticle, input: SaveInput): string | null {
  if (!("coverKey" in input)) return existing.coverKey;
  return input.coverKey ?? null;
}

export async function deleteArticle(id: string): Promise<boolean> {
  const article = await getArticleById(id);
  if (!article) return false;

  // Row first, bytes second — the same order as a cover swap in `saveArticle`,
  // and for the same reason: a failure between the two must leave an orphan,
  // never a story pointing at bytes that are gone.
  await getDb().delete(newsArticle).where(eq(newsArticle.id, id));
  await dropMedia(article.coverKey);
  return true;
}

/* --- media -------------------------------------------------------------- */

/**
 * Seeded stories borrow photographs already in `public/`.
 *
 * They are addressed as `seed:brand/mock-03.jpg` rather than copied into the
 * store, so the seed costs nothing in the database and `public/brand/*` —
 * which the constraints fence off — is only ever read.
 */
const SEED_PREFIX = "seed:";

const publicDir = resolve(process.cwd(), "public");

/**
 * What a cover may be, by extension.
 *
 * SVG is deliberately absent. An SVG is a document that can carry script, and
 * this route serves it from the site's own origin — `nosniff` does not help,
 * because `image/svg+xml` is the correct type and the browser will honour it.
 * Nothing needs it: uploads are restricted to the four raster types in
 * `COVER_TYPES`, and no seeded cover is a vector file. Leaving it out costs
 * nothing and closes the one shape of file that could execute.
 */
const CONTENT_TYPES: Readonly<Record<string, string>> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
};

/**
 * Stores an uploaded cover on disk and returns its new key.
 *
 * The key stays a `med_<12 hex>` handle rather than becoming the content
 * digest: every article row, every cached URL and the route below already
 * speak it, and an editor who re-uploads the same photograph to two stories
 * should still be able to remove one cover without the other going blank. The
 * digest does its deduplicating one level down, in `stored_file`.
 */
export async function putMedia(bytes: Uint8Array, contentType: string): Promise<string> {
  const key = newId("med_", 6);
  await putOwnedFile({ ownerKind: "news_media", ownerKey: key, bytes, contentType });
  return key;
}

/**
 * Uploaded covers only. A `seed:` key points at a file this store does not
 * own, and a URL key points at someone else's host — there are no bytes of
 * either in `news_media` to delete.
 *
 * Exported for one caller outside the store: the save action, which uploads
 * before it saves and has to take the upload back if the save then fails.
 */
export async function dropMedia(key: string | null): Promise<void> {
  if (!key || key.startsWith(SEED_PREFIX) || isUrlCoverKey(key)) return;
  await dropOwnedFile("news_media", key);
  // Both places, because during the transition a cover may still be chunks:
  // deleting only the new home would leave the old rows to answer the next
  // read, and the cover would come back from the dead.
  await getDb().delete(newsMedia).where(eq(newsMedia.key, key));
}

export async function getMedia(
  key: string,
): Promise<{ bytes: Buffer; contentType: string } | null> {
  if (!key) return null;
  if (key.startsWith(SEED_PREFIX)) return readSeedMedia(key.slice(SEED_PREFIX.length));
  // A hosted cover is linked to directly (see `coverUrl`). Answering it here
  // would make this route an open proxy, so it is simply not a key.
  if (isUrlCoverKey(key)) return null;

  // Where uploads go now: the bytes are a file, the row is only the label.
  const stored = await readOwnedFile("news_media", key);
  if (stored) return { bytes: stored.bytes, contentType: stored.contentType };

  // Not moved yet (or written before this change). Reading the chunks keeps
  // every cover on the site live while `scripts/files/move-to-disk.ts` works
  // through them, instead of the front page going blank at deploy time.
  const chunks = await getDb()
    .select({ contentType: newsMedia.contentType, data: newsMedia.data })
    .from(newsMedia)
    .where(eq(newsMedia.key, key))
    .orderBy(asc(newsMedia.chunkIndex));
  if (chunks.length === 0) return null;

  return {
    bytes: Buffer.from(chunks.map((chunk) => chunk.data).join(""), "base64"),
    contentType: chunks[0].contentType,
  };
}

/**
 * Reads one file from `public/`, and only from `public/`.
 *
 * This is the single place in the newsroom where a string out of a record
 * becomes a filesystem read, so the containment check is explicit rather than
 * implied by the key format: resolve the path, then confirm the result is still
 * inside `public/` before opening it. A relative path that climbs out, an
 * absolute path, and a byte-stuffed separator all fail the same test.
 */
function readSeedMedia(name: string): { bytes: Buffer; contentType: string } | null {
  if (!name || name.includes("\0")) return null;

  const path = resolve(publicDir, name);
  const inside = relative(publicDir, path);
  if (inside.startsWith("..") || resolve(publicDir, inside) !== path) return null;

  const extension = path.slice(path.lastIndexOf(".")).toLowerCase();
  const contentType = CONTENT_TYPES[extension];
  if (!contentType) return null;

  try {
    if (!existsSync(path)) return null;
    return { bytes: readFileSync(path), contentType };
  } catch {
    return null;
  }
}
