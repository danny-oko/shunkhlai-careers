import type { NewsArticle } from "@/lib/news/types";

/**
 * What `scripts/news/sync.ts` will say to D1, worked out before it says it.
 *
 * Pure on purpose: the script reads the table, hands the rows it found to
 * `planSync`, and then either prints the plan (`--dry-run`) or runs it. The
 * decisions — insert, overwrite, leave alone, retire — are all made here, so
 * they are tested here, without a database.
 *
 * Nothing in the plan deletes. The worst a statement can do is overwrite a
 * story from the source file, and that only with `--force`.
 */

/** The columns the sync needs to know about a row that is already there. */
export type ExistingRow = { id: string; slug: string; status: string; featured: number | boolean };

export type SyncStatement = {
  sql: string;
  params: Array<string | number | null>;
  /** One line for the log: what this statement is for. */
  note: string;
};

export type SyncPlan = {
  statements: SyncStatement[];
  inserted: string[];
  updated: string[];
  /** Already in D1 and not overwritten (no `--force`). */
  kept: string[];
  /** Not written because another row already holds the slug. */
  blocked: string[];
  /** Placeholder rows that will be set to draft. */
  drafted: string[];
};

const COLUMNS = [
  "id",
  "slug",
  "title",
  "lede",
  "category",
  "author",
  "published_at",
  "cover_key",
  "cover_alt",
  "body_json",
  "status",
  "featured",
  "created_at",
  "updated_at",
] as const;

/** Everything but the id and `created_at`: what an overwrite may change. */
const UPDATABLE = COLUMNS.filter((column) => column !== "id" && column !== "created_at");

/** Keyed by column name — quoted, because they are SQL names, not ours. */
function values(
  article: NewsArticle,
  now: string,
): Record<(typeof COLUMNS)[number], string | number | null> {
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    lede: article.lede,
    category: article.category,
    author: article.author,
    "published_at": article.publishedAt,
    "cover_key": article.coverKey,
    "cover_alt": article.coverAlt,
    "body_json": JSON.stringify(article.body),
    status: article.status,
    featured: article.featured ? 1 : 0,
    "created_at": article.createdAt || now,
    "updated_at": now,
  };
}

function insert(article: NewsArticle, now: string): SyncStatement {
  const row = values(article, now);
  return {
    // `ON CONFLICT DO NOTHING`: if the row appeared between the read and this
    // write, an insert must still never become an overwrite.
    sql: `INSERT INTO news_article (${COLUMNS.join(", ")}) VALUES (${COLUMNS.map(() => "?").join(", ")}) ON CONFLICT(id) DO NOTHING`,
    params: COLUMNS.map((column) => row[column]),
    note: `insert ${article.id}`,
  };
}

function overwrite(article: NewsArticle, now: string): SyncStatement {
  const row = values(article, now);
  return {
    sql: `UPDATE news_article SET ${UPDATABLE.map((column) => `${column} = ?`).join(", ")} WHERE id = ?`,
    params: [...UPDATABLE.map((column) => row[column]), article.id],
    note: `overwrite ${article.id} (--force)`,
  };
}

/**
 * There is one lead slot. Writing a featured story therefore takes the flag
 * from every other row, exactly as the desk's star does — otherwise a
 * `--force` run after an editor promoted something else would leave two
 * leads. Bound to the id, and run straight after the write it belongs to.
 */
function demoteOthers(id: string, now: string): SyncStatement {
  return {
    sql: "UPDATE news_article SET featured = 0, updated_at = ? WHERE featured = 1 AND id <> ?",
    params: [now, id],
    note: `one lead: demote every row but ${id}`,
  };
}

export function planSync(input: {
  articles: readonly NewsArticle[];
  existing: readonly ExistingRow[];
  placeholderIds: readonly string[];
  force: boolean;
  now: string;
}): SyncPlan {
  const byId = new Map(input.existing.map((row) => [row.id, row]));
  const slugOwner = new Map(input.existing.map((row) => [row.slug, row.id]));

  const plan: SyncPlan = {
    statements: [],
    inserted: [],
    updated: [],
    kept: [],
    blocked: [],
    drafted: [],
  };

  for (const article of input.articles) {
    // The slug index is unique. A different row holding this slug would fail
    // the write halfway through the run, so it is refused up front instead.
    const owner = slugOwner.get(article.slug);
    if (owner && owner !== article.id) {
      plan.blocked.push(article.id);
      continue;
    }

    if (!byId.has(article.id)) {
      plan.statements.push(insert(article, input.now));
      plan.inserted.push(article.id);
    } else if (input.force) {
      plan.statements.push(overwrite(article, input.now));
      plan.updated.push(article.id);
    } else {
      // An editor may have changed it since the last sync; their edit wins.
      plan.kept.push(article.id);
      continue;
    }

    if (article.featured) plan.statements.push(demoteOthers(article.id, input.now));
  }

  // Last, so a run that fails partway never leaves the site with the old
  // stories retired and the new ones not yet written. Every placeholder id,
  // whatever the read said about it: the statement is idempotent, and a plan
  // that trusted a stale read could leave one published.
  const retire = [...input.placeholderIds];
  if (retire.length > 0) {
    plan.statements.push({
      // Draft, and off the lead slot: a featured draft would still be demoted
      // by the desk's star, but it has no business holding the flag.
      sql: `UPDATE news_article SET status = 'draft', featured = 0, updated_at = ? WHERE id IN (${retire.map(() => "?").join(", ")})`,
      params: [input.now, ...retire],
      note: `draft ${retire.length} placeholder row(s)`,
    });
    plan.drafted.push(...retire);
  }

  return plan;
}
