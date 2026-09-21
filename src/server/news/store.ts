import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

import { coerceBody } from "@/lib/news/legacy";
import type { RichDoc } from "@/lib/news/shared/rich-text";
import { uniqueSlug } from "@/lib/news/shared/slug";
import {
  NEWS_CATEGORIES,
  type NewsArticle,
  type NewsCategory,
  type NewsStatus,
} from "@/lib/news/types";

import { seedArticles } from "./seed";

/**
 * Storage for the newsroom.
 *
 * Deliberately the same shape as `src/server/mock/store.ts`: state on
 * `globalThis` so a hot reload does not empty the desk mid-edit, mirrored to
 * `.mock-data/` after every write so a dev-server restart does not either, and
 * persistence switched off in production where the filesystem is read-only.
 *
 * Unlike that module this is not a stand-in for anything. The recruitment
 * backend has no news endpoints — there is nothing to mock — so this *is* the
 * newsroom's database for as long as the newsroom has no other one. When a CMS
 * or a real table arrives, this file is the seam: the functions below are what
 * the rest of the app knows, and `service.ts` is the only thing that calls them.
 */

export type ListQuery = {
  /** Public reads get published only; the admin desk asks for "all". */
  status?: NewsStatus | "all";
  category?: NewsCategory | null;
  search?: string;
  limit?: number;
};

type MediaRecord = { contentType: string; base64: string };

type Db = {
  articles: NewsArticle[];
  media: Record<string, MediaRecord>;
  /**
   * Whether the seed has already been laid down.
   *
   * Tracked separately from `articles.length` because the two answer different
   * questions. An editor who deletes every story has an empty newsroom on
   * purpose, and keying the seed off emptiness would resurrect all seven of
   * them on the next restart — deleting something twice and having it come
   * back is worse than never having seeded at all.
   */
  seeded: boolean;
};

/** What `.mock-data/news.json` holds. */
type PersistedArticles = { seeded: boolean; articles: NewsArticle[] };

const globalRef = globalThis as typeof globalThis & { __newsroomDb?: Db };

/* --- persistence (development only) ------------------------------------- */

/**
 * Off in production, where the filesystem is read-only — and off under the
 * test runner, which is not a nicety. The store writes to `process.cwd()`, and
 * the suite exercises `saveArticle` and `deleteArticle` dozens of times, so a
 * test run was overwriting `.mock-data/news.json` with whatever the last case
 * left behind: running the tests emptied the developer's newsroom.
 */
const persists =
  process.env.NODE_ENV !== "production" &&
  process.env.NODE_ENV !== "test" &&
  !process.env.VITEST;

const dataDir = join(process.cwd(), ".mock-data");
const articlesFile = join(dataDir, "news.json");
const mediaFile = join(dataDir, "news-media.json");

/**
 * Uploads live in their own file.
 *
 * A cover is held as base64, so one 4MB photograph is ~5.5MB of JSON. Keeping
 * it out of `news.json` means the article list — the file that is read and
 * rewritten on every single edit — stays a few kilobytes.
 */
function readFile<T>(path: string, fallback: T): T {
  if (!persists) return fallback;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    // No file yet, or one left by an older shape. Starting clean beats taking
    // the server down over a dev scratch file.
    return fallback;
  }
}

/** Through a temp file: a half-written JSON is unreadable, which loses everything. */
function writeAtomic(path: string, value: unknown): void {
  if (!persists) return;
  try {
    mkdirSync(dirname(path), { recursive: true });
    const pending = `${path}.tmp`;
    writeFileSync(pending, JSON.stringify(value), "utf8");
    renameSync(pending, path);
  } catch {
    // Persistence is a convenience. A read-only mount or a full disk must not
    // turn into a failed save the editor sees as lost work.
  }
}

function saveArticles(): void {
  writeAtomic(articlesFile, { seeded: db.seeded, articles: db.articles });
}

function saveMedia(): void {
  writeAtomic(mediaFile, db.media);
}

/* --- ids ---------------------------------------------------------------- */

function newId(prefix: string, bytes: number): string {
  return `${prefix}${randomBytes(bytes).toString("hex")}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

/* --- load --------------------------------------------------------------- */

/**
 * Files written before rich text hold `NewsBlock[]` bodies. Reading them
 * through `coerceBody` means an old `.mock-data/news.json` still loads; the
 * next save writes the new shape.
 */
function withDocBodies(articles: NewsArticle[]): NewsArticle[] {
  return articles.map((article) => ({ ...article, body: coerceBody(article.body) }));
}

function loadDb(): Db {
  const saved = readFile<PersistedArticles | NewsArticle[] | null>(articlesFile, null);
  const media = readFile<Record<string, MediaRecord>>(mediaFile, {});

  // An array is the shape an earlier build wrote. Reading it as already-seeded
  // is the right guess: it only exists because that build seeded it.
  if (Array.isArray(saved)) return { articles: withDocBodies(saved), media, seeded: true };
  if (saved?.seeded) {
    return { articles: withDocBodies(saved.articles ?? []), media, seeded: true };
  }

  // First run on this machine. The desk is seeded rather than empty because an
  // empty newsroom cannot be reviewed: there is no way to see the front page,
  // the category rail or the archive without stories in them.
  const created = nowIso();
  const taken: string[] = [];
  const articles = seedArticles().map((draft) => {
    const slug = uniqueSlug(draft.title, taken);
    taken.push(slug);
    return { ...draft, id: newId("art_", 5), slug, createdAt: created, updatedAt: created };
  });

  const db: Db = { articles, media, seeded: true };
  writeAtomic(articlesFile, { seeded: true, articles });
  return db;
}

export const db: Db = globalRef.__newsroomDb ?? (globalRef.__newsroomDb = loadDb());

/** Empties the desk. Tests only — nothing in the app has a reason to call it. */
export function resetForTests(): void {
  db.articles = [];
  db.media = {};
  db.seeded = true;
}

/* --- reads -------------------------------------------------------------- */

/**
 * Newest first, with a featured story lifted above its date-mates.
 *
 * `publishedAt` is a plain `YYYY-MM-DD` string, so a lexical compare is also
 * the chronological one. `createdAt` breaks the remaining ties, which keeps the
 * order stable when an editor files two stories on the same day.
 */
function compare(a: NewsArticle, b: NewsArticle): number {
  if (a.publishedAt !== b.publishedAt) return a.publishedAt < b.publishedAt ? 1 : -1;
  if (a.featured !== b.featured) return a.featured ? -1 : 1;
  return a.createdAt < b.createdAt ? 1 : -1;
}

function haystack(article: NewsArticle): string {
  return `${article.title} ${article.lede} ${article.author}`.toLowerCase();
}

export function listArticles(query: ListQuery = {}): NewsArticle[] {
  const status = query.status ?? "published";
  const search = (query.search ?? "").trim().toLowerCase();

  const rows = db.articles.filter((article) => {
    if (status !== "all" && article.status !== status) return false;
    if (query.category && article.category !== query.category) return false;
    if (search && !haystack(article).includes(search)) return false;
    return true;
  });

  rows.sort(compare);
  return typeof query.limit === "number" ? rows.slice(0, Math.max(0, query.limit)) : rows;
}

export function getArticleBySlug(slug: string): NewsArticle | null {
  return db.articles.find((article) => article.slug === slug) ?? null;
}

export function getArticleById(id: string): NewsArticle | null {
  return db.articles.find((article) => article.id === id) ?? null;
}

/**
 * Counts for the category rail.
 *
 * Every category is present even at zero: the rail renders a fixed set of
 * links, and a missing key there would read as a missing section rather than
 * as an empty one.
 */
export function countByCategory(
  status: NewsStatus | "all" = "published",
): Record<NewsCategory, number> {
  const counts = Object.fromEntries(
    NEWS_CATEGORIES.map((category) => [category.value, 0]),
  ) as Record<NewsCategory, number>;

  for (const article of db.articles) {
    if (status !== "all" && article.status !== status) continue;
    counts[article.category] += 1;
  }

  return counts;
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
   * a string replaces it, and an explicit `null` removes it.
   */
  coverKey?: string | null;
};

export function saveArticle(input: SaveInput): NewsArticle {
  const existing = input.id ? getArticleById(input.id) : null;
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
      slug: uniqueSlug(fields.title, db.articles.map((row) => row.slug)),
      coverKey: input.coverKey ?? null,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    db.articles.push(article);
    saveArticles();
    return article;
  }

  // A published URL is a promise. Re-slugging on every save would break every
  // link to the story the moment someone fixed a typo in the standfirst, so the
  // slug only moves when the headline itself does — and `keep` lets it stay put
  // when the new headline slugifies to the slug it already has.
  const slug =
    fields.title === existing.title
      ? existing.slug
      : uniqueSlug(fields.title, db.articles.map((row) => row.slug), existing.slug);

  const coverKey = resolveCoverKey(existing, input);

  const updated: NewsArticle = {
    ...existing,
    ...fields,
    slug,
    coverKey,
    updatedAt: timestamp,
  };

  db.articles = db.articles.map((row) => (row.id === existing.id ? updated : row));
  saveArticles();
  return updated;
}

/** Applies the three-state `coverKey`, dropping the bytes of a cover it replaces. */
function resolveCoverKey(existing: NewsArticle, input: SaveInput): string | null {
  if (!("coverKey" in input)) return existing.coverKey;
  if (input.coverKey === existing.coverKey) return existing.coverKey;

  dropMedia(existing.coverKey);
  return input.coverKey ?? null;
}

export function deleteArticle(id: string): boolean {
  const article = getArticleById(id);
  if (!article) return false;

  dropMedia(article.coverKey);
  db.articles = db.articles.filter((row) => row.id !== id);
  saveArticles();
  return true;
}

/* --- media -------------------------------------------------------------- */

/**
 * Seeded stories borrow photographs already in `public/`.
 *
 * They are addressed as `seed:brand/mock-03.jpg` rather than copied into the
 * store, so the seed costs nothing on disk and `public/brand/*` — which the
 * constraints fence off — is only ever read.
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

export function putMedia(bytes: Uint8Array, contentType: string): string {
  const key = newId("med_", 6);
  db.media[key] = { contentType, base64: Buffer.from(bytes).toString("base64") };
  saveMedia();
  return key;
}

/** Uploaded covers only — a `seed:` key points at a file this store does not own. */
function dropMedia(key: string | null): void {
  if (!key || key.startsWith(SEED_PREFIX) || !(key in db.media)) return;
  delete db.media[key];
  saveMedia();
}

export function getMedia(key: string): { bytes: Buffer; contentType: string } | null {
  if (!key) return null;
  if (key.startsWith(SEED_PREFIX)) return readSeedMedia(key.slice(SEED_PREFIX.length));

  const record = db.media[key];
  if (!record) return null;
  return { bytes: Buffer.from(record.base64, "base64"), contentType: record.contentType };
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
