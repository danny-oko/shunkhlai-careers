import Link from "next/link";
import { ExternalLink, Pencil, Star } from "lucide-react";

import { setFeaturedAction, setStatusAction } from "@/app/admin/news/actions";
import { DeleteArticleButton } from "@/components/admin/delete-article-button";
import { NewsCover } from "@/components/news/news-cover";
import { Button } from "@/components/ui/button";
import {
  type NewsArticle,
  categoryLabel,
  formatNewsDateShort,
  readingMinutes,
  statusHint,
  statusLabel,
} from "@/lib/news/types";
import { cn } from "@/lib/utils";

/**
 * One story on the desk.
 *
 * Every control here is a `<form>` rather than a link, because each of them
 * changes something. Publish, feature and delete are one press each — those
 * are the three edits an editor makes without wanting to open the article —
 * and everything else is behind "Засах".
 *
 * Delete is the exception: it needs a confirmation, a confirmation is an
 * event handler, and a handler cannot cross into a server component — so it
 * lives in `<DeleteArticleButton>` on the client.
 */
export function ArticleRow({
  article,
  canDelete,
}: {
  article: NewsArticle;
  /** `editor` accounts do not get the control; the action refuses them too. */
  canDelete: boolean;
}) {
  const isPublished = article.status === "published";

  return (
    /* Wraps rather than stacks. Stacking put a full-width 3:2 thumbnail at
       the top of every row on a phone — a quarter of the screen each, for a
       picture nobody is browsing by. The thumbnail stays small at every width
       and it is the action group that drops to its own line instead. */
    <li className="flex flex-wrap items-start gap-3 py-4 sm:flex-nowrap sm:gap-5">
      <Link
        href={`/admin/news/${article.id}`}
        tabIndex={-1}
        aria-hidden
        className="w-16 shrink-0 sm:w-28"
      >
        <NewsCover
          coverKey={article.coverKey}
          alt=""
          ratio="3 / 2"
          sizes="(min-width: 640px) 112px, 64px"
        />
      </Link>

      <div className="min-w-[10rem] flex-1 basis-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            title={statusHint(article.status)}
            className={cn(
              "px-1.5 py-0.5 text-[0.5625rem] font-semibold tracking-[0.12em] uppercase",
              isPublished
                ? "bg-foreground text-background"
                : "border border-border text-muted-foreground",
            )}
          >
            {statusLabel(article.status)}
          </span>

          {article.featured && (
            <span
              className="flex items-center gap-1 text-[0.5625rem] font-semibold tracking-[0.12em] uppercase"
              style={{ color: "var(--paper-accent)" }}
            >
              <Star aria-hidden className="size-2.5 fill-current" />
              Гол мэдээ
            </span>
          )}

          <span className="text-[0.5625rem] tracking-[0.12em] text-muted-foreground uppercase">
            {categoryLabel(article.category)}
          </span>
        </div>

        <h3 className="news-headline mt-1.5 text-[1.0625rem] sm:text-lg">
          <Link
            href={`/admin/news/${article.id}`}
            className="decoration-1 underline-offset-4 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            {article.title}
          </Link>
        </h3>

        <p className="mt-1 text-[0.6875rem] tracking-[0.08em] text-muted-foreground uppercase tabular-nums">
          {formatNewsDateShort(article.publishedAt)} · {article.author} ·{" "}
          {readingMinutes(article.body)} мин
        </p>
      </div>

      {/* Wraps but does not overflow. It used to be `shrink-0`, which was safe
          while the desk had the whole window; beside the sidebar the same row
          at 1024px pushed the delete control off the right edge. Shrinking
          lets the group fold onto a second line instead. */}
      <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
        <form action={setFeaturedAction}>
          <input type="hidden" name="id" value={article.id} />
          {!article.featured && <input type="hidden" name="featured" value="on" />}
          <Button
            type="submit"
            variant="ghost"
            size="sm"
          >
            <Star aria-hidden className={article.featured ? "fill-current" : undefined} />
            {article.featured ? "Гол мэдээнээс хасах" : "Гол мэдээ болгох"}
          </Button>
        </form>

        <form action={setStatusAction}>
          <input type="hidden" name="id" value={article.id} />
          <input type="hidden" name="status" value={isPublished ? "draft" : "published"} />
          <Button type="submit" variant="outline" size="sm">
            {isPublished ? "Нуух" : "Нийтлэх"}
          </Button>
        </form>

        {isPublished && (
          <Button asChild variant="ghost" size="sm">
            <Link href={`/news/${article.slug}`} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden />
              Нийтлэл харах
            </Link>
          </Button>
        )}

        <Button asChild variant="outline" size="sm">
          <Link href={`/admin/news/${article.id}`}>
            <Pencil aria-hidden />
            Засах
          </Link>
        </Button>

        {canDelete && <DeleteArticleButton id={article.id} title={article.title} />}
      </div>
    </li>
  );
}
