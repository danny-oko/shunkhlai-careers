import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Dateline } from "@/components/news/dateline";
import { Kicker } from "@/components/news/kicker";
import { NewsCover } from "@/components/news/news-cover";
import type { NewsArticle } from "@/lib/news/types";
import { cn } from "@/lib/utils";

/**
 * One story in a column.
 *
 * The whole card is a single link rather than a card with a link in it: a
 * reader aiming at a headline should not be able to miss and hit nothing, and
 * one link per story is also one tab stop per story instead of three.
 */
export function StoryCard({
  article,
  sizes,
  className,
}: {
  article: NewsArticle;
  sizes: string;
  className?: string;
}) {
  return (
    <article className={className}>
      <Link
        href={`/news/${article.slug}`}
        className={cn(
          "group block focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
          "focus-visible:-outline-offset-2",
        )}
      >
        <NewsCover
          coverKey={article.coverKey}
          alt={article.coverAlt}
          ratio="3 / 2"
          sizes={sizes}
        />

        <Kicker category={article.category} className="mt-4" />

        <h3 className="news-headline mt-2 text-xl decoration-1 underline-offset-4 group-hover:underline sm:text-[1.3125rem]">
          {article.title}
        </h3>

        {/* Three lines is the most a column of this width can hold without the
            card growing taller than its photograph is wide. */}
        <p className="news-body news-body-card mt-2 line-clamp-3 text-muted-foreground">
          {article.lede}
        </p>

        <Dateline article={article} className="mt-3" />

        <span
          aria-hidden
          className="mt-3 inline-flex items-center gap-1.5 type-kicker font-semibold tracking-[0.14em] uppercase"
          style={{ color: "var(--paper-accent)" }}
        >
          Үргэлжлүүлэн унших
          <ArrowRight className="size-3.5 transition-transform group-hover:translate-x-0.5" />
        </span>
      </Link>
    </article>
  );
}
