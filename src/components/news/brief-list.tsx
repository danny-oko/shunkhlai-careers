import Link from "next/link";

import { Dateline } from "@/components/news/dateline";
import { categoryLabel, type NewsArticle } from "@/lib/news/types";

/**
 * The archive, set as an index.
 *
 * No photographs by design. A front page that is photographs all the way down
 * gives a reader no way to skim, so the tail of it becomes a numbered list —
 * the shape a newspaper uses for its own index, and the fastest thing on the
 * page to scan.
 */
export function BriefList({
  articles,
  startAt = 1,
}: {
  articles: NewsArticle[];
  /** Continues the count from the stories already shown above. */
  startAt?: number;
}) {
  return (
    <ol className="divide-y divide-border border-y border-border">
      {articles.map((article, index) => (
        <li key={article.id}>
          <Link
            href={`/news/${article.slug}`}
            className="group flex items-baseline gap-4 py-4 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:gap-6"
          >
            <span
              aria-hidden
              className="w-7 shrink-0 text-[1.0625rem] font-semibold tabular-nums"
              style={{ color: "var(--paper-accent)" }}
            >
              {String(startAt + index).padStart(2, "0")}
            </span>

            <span className="min-w-0 flex-1">
              <span className="news-headline block text-[1.0625rem] decoration-1 underline-offset-4 group-hover:underline sm:text-lg">
                {article.title}
              </span>
              <Dateline article={article} className="mt-1.5" />
            </span>

            <span className="hidden shrink-0 type-kicker tracking-[0.14em] text-muted-foreground uppercase sm:block">
              {categoryLabel(article.category)}
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
