import "server-only";

import { cache } from "react";

import {
  countByCategory,
  getArticleById,
  getArticleBySlug,
  listArticles,
} from "@/server/news/store";

import type { NewsArticle, NewsCategory, NewsStatus } from "./types";

/**
 * What the pages are allowed to ask for.
 *
 * `src/lib/jobs/local.ts` is the precedent: a server-side read goes straight
 * to the source rather than back out through HTTP, because a render that
 * happens before the server is listening cannot fetch from itself.
 *
 * The store is Cloudflare D1 over HTTP, so any read can fail — the network,
 * an expired token, a missing env var. The public reads below absorb that and
 * answer "nothing": a reader then sees the newsroom's own empty state (or its
 * 404) instead of a 500. The admin reads do not; the desk has to tell the
 * editor that the database is unreachable, not pretend the desk is empty.
 *
 * `server-only` is the guard that keeps the store out of a client bundle: the
 * store holds the D1 token, and an accidental `"use client"` above an import
 * of it would be a build error here rather than a mystery at runtime.
 */

const EMPTY_COUNTS: Record<NewsCategory, number> = {
  company: 0,
  industry: 0,
  society: 0,
  people: 0,
};

/** Runs a public read, falling back to `fallback` if the database is down. */
async function orElse<T>(read: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await read();
  } catch (error) {
    console.error("[news] D1 read failed:", error instanceof Error ? error.message : error);
    return fallback;
  }
}

/**
 * Every published story, newest first — read once per render.
 *
 * A page asks for this in several shapes: the front page for the lead and for
 * the rail's total, an article for its neighbours and for "more from the
 * desk". Each used to be its own query, and each query carries every story's
 * body. React's `cache` memoises for the length of one server render and no
 * longer, so this is not a cache in the sense the store rules out: the next
 * request reads the database again, and an edit made from any host is on the
 * page it renders. Callers get a list to read, never to change.
 */
const publishedStories = cache(() =>
  orElse(() => listArticles({ status: "published" }), [] as NewsArticle[]),
);

export async function getPublishedArticles(query: {
  category?: NewsCategory | null;
  search?: string;
  limit?: number;
} = {}): Promise<NewsArticle[]> {
  // A search is matched in the store, as it always was; only the plain lists
  // (the whole newsroom, or one desk of it) come from the shared read.
  if (query.search?.trim()) {
    return orElse(() => listArticles({ ...query, status: "published" }), []);
  }

  const stories = await publishedStories();
  const desk = query.category
    ? stories.filter((article) => article.category === query.category)
    : stories;
  return typeof query.limit === "number"
    ? desk.slice(0, Math.max(0, query.limit))
    : desk.slice();
}

/** Published only — a draft's URL must 404 even for someone who guesses it. */
export const getArticle = cache(async (slug: string): Promise<NewsArticle | null> => {
  const article = await orElse(() => getArticleBySlug(slug), null);
  return article?.status === "published" ? article : null;
});

/**
 * The stories either side of this one, in reading order.
 *
 * `previous` is older and `next` is newer, matching the direction a reader
 * moves through an archive rather than the direction the list is sorted in.
 */
export async function getAdjacent(
  slug: string,
): Promise<{ previous: NewsArticle | null; next: NewsArticle | null }> {
  const published = await publishedStories();
  const index = published.findIndex((article) => article.slug === slug);
  if (index === -1) return { previous: null, next: null };

  return {
    previous: published[index + 1] ?? null,
    next: index > 0 ? published[index - 1] : null,
  };
}

export async function getCategoryCounts(): Promise<Record<NewsCategory, number>> {
  return orElse(() => countByCategory("published"), { ...EMPTY_COUNTS });
}

/**
 * More from the same desk.
 *
 * A thin category would otherwise leave the foot of an article empty, so it
 * falls back to the newest published stories — a reader at the end of a piece
 * wants somewhere to go next more than they want it to be on-topic.
 */
export async function getLatestForRelated(
  slug: string,
  category: NewsCategory,
  limit = 3,
): Promise<NewsArticle[]> {
  const published = await publishedStories();
  const sameDesk = published.filter(
    (article) => article.category === category && article.slug !== slug,
  );
  if (sameDesk.length >= limit) return sameDesk.slice(0, limit);

  const seen = new Set([slug, ...sameDesk.map((article) => article.slug)]);
  const filler = published.filter((article) => !seen.has(article.slug));

  return [...sameDesk, ...filler].slice(0, limit);
}

/* --- admin reads (behind requireAdmin) ---------------------------------- */

/* These throw on a D1 failure; the admin pages catch and say so in Mongolian. */

export async function getAdminArticles(
  query: { status?: NewsStatus | "all"; search?: string } = {},
): Promise<NewsArticle[]> {
  return listArticles({ status: query.status ?? "all", search: query.search });
}

/** Any status: the edit screen has to be able to open a draft. */
export async function getAdminArticle(id: string): Promise<NewsArticle | null> {
  return getArticleById(id);
}
