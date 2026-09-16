import { type NewsArticle, formatNewsDate, formatNewsDateShort, readingMinutes } from "@/lib/news/types";
import { cn } from "@/lib/utils";

/**
 * Byline and date, in the order a newspaper prints them.
 *
 * Sans-serif and letterspaced against the serif headline above it, because the
 * only way a reader tells metadata from copy at a glance is that it is set in
 * the other family.
 */
export function Dateline({
  article,
  long = false,
  showReading = false,
  className,
}: {
  article: NewsArticle;
  /** The long Mongolian date, for the article page. Cards use the numeric one. */
  long?: boolean;
  showReading?: boolean;
  className?: string;
}) {
  const parts = [
    article.author,
    long ? formatNewsDate(article.publishedAt) : formatNewsDateShort(article.publishedAt),
    showReading ? `${readingMinutes(article.body)} мин уншина` : null,
  ].filter(Boolean);

  return (
    <p
      className={cn(
        "flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.6875rem] tracking-[0.08em] text-muted-foreground uppercase",
        className,
      )}
    >
      {parts.map((part, index) => (
        <span key={part} className="flex items-center gap-2">
          {index > 0 && (
            <span aria-hidden className="text-border">
              ·
            </span>
          )}
          {part}
        </span>
      ))}
    </p>
  );
}
