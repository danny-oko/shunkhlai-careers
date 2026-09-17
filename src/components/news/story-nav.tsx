import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";

import type { NewsArticle } from "@/lib/news/types";

/**
 * Older and newer, at the foot of an article.
 *
 * Labelled by direction in time rather than "previous/next", which in a
 * right-to-left reading of a list means the opposite thing to half of readers.
 */
export function StoryNav({
  previous,
  next,
}: {
  previous: NewsArticle | null;
  next: NewsArticle | null;
}) {
  if (!previous && !next) return null;

  return (
    <nav
      aria-label="Бусад мэдээ"
      className="grid gap-px border-y border-border bg-border sm:grid-cols-2"
    >
      {[
        { article: previous, label: "Өмнөх мэдээ", icon: "back" as const },
        { article: next, label: "Дараах мэдээ", icon: "forward" as const },
      ].map(({ article, label, icon }) =>
        article ? (
          <Link
            key={label}
            href={`/news/${article.slug}`}
            className="group flex flex-col gap-2 bg-background p-5 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none sm:p-6"
          >
            <span className="flex items-center gap-2 text-[0.625rem] tracking-[0.14em] text-muted-foreground uppercase">
              {icon === "back" && <ArrowLeft aria-hidden className="size-3" />}
              {label}
              {icon === "forward" && <ArrowRight aria-hidden className="size-3" />}
            </span>
            <span className="news-headline text-[1.0625rem] decoration-1 underline-offset-4 group-hover:underline sm:text-lg">
              {article.title}
            </span>
          </Link>
        ) : (
          /* An empty cell rather than a collapsed grid: the remaining link
             stays in its own column instead of stretching across both. */
          <div key={label} aria-hidden className="bg-background" />
        ),
      )}
    </nav>
  );
}
