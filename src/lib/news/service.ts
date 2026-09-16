import "server-only";

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
 * happens before the server is listening cannot fetch from itself. Everything
 * here is `async` even though nothing awaits yet — that is the seam. When the
 * newsroom moves behind a real API or a database, these seven functions change
 * and no page does.
 *
 * `server-only` is the guard that keeps the store out of a client bundle: the
 * store reads the filesystem, and an accidental `"use client"` above an import
 * of it would be a build error here rather than a mystery at runtime.
 */

export async function getPublishedArticles(query: {
  category?: NewsCategory | null;
  search?: string;
  limit?: number;
} = {}): Promise<NewsArticle[]> {
  return listArticles({ ...query, status: "published" });
}

/** Published only — a draft's URL must 404 even for someone who guesses it. */
export async function getArticle(slug: string): Promise<NewsArticle | null> {
  const article = getArticleBySlug(slug);
  return article?.status === "published" ? article : null;
}

/**
 * The stories either side of this one, in reading order.
 *
 * `previous` is older and `next` is newer, matching the direction a reader
 * moves through an archive rather than the direction the list is sorted in.
 */
export async function getAdjacent(
  slug: string,
): Promise<{ previous: NewsArticle | null; next: NewsArticle | null }> {
  const published = listArticles({ status: "published" });
  const index = published.findIndex((article) => article.slug === slug);
  if (index === -1) return { previous: null, next: null };

  return {
    previous: published[index + 1] ?? null,
    next: index > 0 ? published[index - 1] : null,
  };
}

export async function getCategoryCounts(): Promise<Record<NewsCategory, number>> {
  return countByCategory("published");
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
  const sameDesk = listArticles({ status: "published", category }).filter(
    (article) => article.slug !== slug,
  );
  if (sameDesk.length >= limit) return sameDesk.slice(0, limit);

  const seen = new Set([slug, ...sameDesk.map((article) => article.slug)]);
  const filler = listArticles({ status: "published" }).filter(
    (article) => !seen.has(article.slug),
  );

  return [...sameDesk, ...filler].slice(0, limit);
}

/* --- admin reads (behind requireAdmin) ---------------------------------- */

export async function getAdminArticles(
  query: { status?: NewsStatus | "all"; search?: string } = {},
): Promise<NewsArticle[]> {
  return listArticles({ status: query.status ?? "all", search: query.search });
}

/** Any status: the edit screen has to be able to open a draft. */
export async function getAdminArticle(id: string): Promise<NewsArticle | null> {
  return getArticleById(id);
}
