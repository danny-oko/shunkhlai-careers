import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { Dateline } from "@/components/news/dateline";
import { Kicker } from "@/components/news/kicker";
import { NewsCover } from "@/components/news/news-cover";
import type { NewsArticle } from "@/lib/news/types";

/**
 * The story above the fold.
 *
 * Asymmetric on purpose — seven columns of photograph against five of type.
 * An even split reads as two equal things; the lead has to read as one thing
 * with a picture, which is also why the headline is the only element on the
 * page allowed past 2.5rem.
 */
export function LeadStory({ article }: { article: NewsArticle }) {
  return (
    <article className="grid gap-6 lg:grid-cols-12 lg:gap-9">
      <Link
        href={`/news/${article.slug}`}
        tabIndex={-1}
        aria-hidden
        className="lg:col-span-7"
      >
        <NewsCover
          coverKey={article.coverKey}
          alt={article.coverAlt}
          ratio="16 / 10"
          priority
          sizes="(min-width: 1024px) 58vw, 100vw"
        />
      </Link>

      <div className="flex flex-col justify-center lg:col-span-5">
        <Kicker category={article.category} />

        <h2 className="news-headline mt-3 text-[clamp(1.75rem,4.4vw,2.875rem)]">
          <Link
            href={`/news/${article.slug}`}
            className="decoration-1 underline-offset-[6px] hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {article.title}
          </Link>
        </h2>

        <p className="news-body mt-4 text-muted-foreground">{article.lede}</p>

        <Dateline article={article} long showReading className="mt-5" />

        <p
          aria-hidden
          className="mt-5 flex items-center gap-1.5 type-kicker font-semibold tracking-[0.14em] uppercase"
          style={{ color: "var(--paper-accent)" }}
        >
          Үргэлжлүүлэн унших
          <ArrowRight className="size-3.5" />
        </p>
      </div>
    </article>
  );
}
