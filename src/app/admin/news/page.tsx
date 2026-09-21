import type { ReactNode } from "react";
import Link from "next/link";
import { CheckCircle2, FileText, Newspaper, Plus } from "lucide-react";

import { ArticleRow } from "@/components/admin/article-row";
import { Button } from "@/components/ui/button";
import { getAdminArticles } from "@/lib/news/service";
import type { NewsArticle } from "@/lib/news/types";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

const FILTERS = [
  { value: "all", label: "Бүгд" },
  { value: "published", label: "Нийтлэгдсэн" },
  { value: "draft", label: "Ноорог" },
] as const;

type Filter = (typeof FILTERS)[number]["value"];

function read(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

/* The ruled strip the three outcomes below are all printed on. */
function NoticeShell({ children }: { children: ReactNode }) {
  return (
    <p className="mb-6 flex items-center gap-2 border border-border bg-muted/50 px-4 py-2.5 text-[0.8125rem]">
      <CheckCircle2 aria-hidden className="size-4 shrink-0" />
      {children}
    </p>
  );
}

/**
 * What just happened to the story that was saved.
 *
 * `/news/[slug]` serves published articles only, so a draft has no public URL
 * to offer — the link used to be printed either way, which put a 404 behind a
 * tick mark on the one screen that had just told the editor the save worked.
 */
function SavedNotice({ article }: { article: NewsArticle }) {
  if (article.status !== "published") {
    return <NoticeShell>Мэдээ ноорогт хадгалагдлаа.</NoticeShell>;
  }

  return (
    <NoticeShell>
      Мэдээ хадгалагдлаа.{" "}
      <Link
        href={`/news/${article.slug}`}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-4"
      >
        Нийтлэг харах
      </Link>
    </NoticeShell>
  );
}

/* The outcome of the last action, stated rather than toasted: a redirect has
   already replaced the page, so a toast would be announcing something the
   editor can no longer see the source of. */
function ActionNotice({ saved, deleted }: { saved?: NewsArticle; deleted: boolean }) {
  if (saved) return <SavedNotice article={saved} />;
  if (deleted) return <NoticeShell>Мэдээ хасагдлаа.</NoticeShell>;
  return null;
}

export default async function AdminNewsPage({
  searchParams,
}: PageProps<"/admin/news">) {
  const params = await searchParams;

  const requested = read(params.status);
  const status: Filter = FILTERS.some((filter) => filter.value === requested)
    ? (requested as Filter)
    : "all";

  const [articles, everything] = await Promise.all([
    getAdminArticles({ status }),
    getAdminArticles({ status: "all" }),
  ]);

  const published = everything.filter((article) => article.status === "published").length;
  const saved = read(params.saved);
  const deleted = read(params.deleted);

  // Looked up rather than taken from the query string: the banner needs the
  // story's status to know whether it has a public URL yet, and a hand-typed
  // `?saved=` should not be able to conjure a link to something that is not
  // there. An empty `saved` matches no slug, so this is `undefined` then too.
  const savedArticle = everything.find((article) => article.slug === saved);

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 lg:px-8">
      <ActionNotice saved={savedArticle} deleted={Boolean(deleted)} />

      <div className="flex flex-wrap items-end justify-between gap-4 border-b-2 border-b-[var(--rule-strong)] pb-4">
        <div>
          <h1 className="news-headline text-2xl sm:text-3xl">Мэдээний удирдлага</h1>
          <p className="mt-1.5 flex items-center gap-3 text-[0.6875rem] tracking-[0.1em] text-muted-foreground uppercase tabular-nums">
            <span className="flex items-center gap-1.5">
              <Newspaper aria-hidden className="size-3" />
              {published} нийтлэгдсэн
            </span>
            <span className="flex items-center gap-1.5">
              <FileText aria-hidden className="size-3" />
              {everything.length - published} ноорог
            </span>
          </p>
        </div>

        {/* Compact by intent — the primary "Шинэ мэдээ" lives in the bar
            above, and two identical buttons on one screen is one too many. */}
        <nav aria-label="Төлвөөр шүүх" className="flex items-center gap-1">
          {FILTERS.map((filter) => {
            const count =
              filter.value === "all"
                ? everything.length
                : everything.filter((article) => article.status === filter.value).length;

            return (
              <Link
                key={filter.value}
                href={`/admin/news?status=${filter.value}`}
                aria-current={status === filter.value ? "page" : undefined}
                className={cn(
                  "rounded-full border px-2.5 py-1 text-[0.6875rem] transition-colors",
                  "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                  status === filter.value
                    ? "border-transparent bg-foreground font-medium text-background"
                    : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {filter.label}
                <span className="ml-1 tabular-nums opacity-60">{count}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {articles.length > 0 ? (
        <ul className="divide-y divide-border">
          {articles.map((article) => (
            <ArticleRow key={article.id} article={article} />
          ))}
        </ul>
      ) : (
        <div className="border-b border-border py-20 text-center">
          <p className="news-headline text-lg">
            {status === "all" ? "Мэдээ байхгүй байна." : "Энэ төлөвт мэдээ байхгүй."}
          </p>
          <Button asChild size="sm" className="mt-5">
            <Link href="/admin/news/new">
              <Plus aria-hidden />
              Эхний мэдээг бичих
            </Link>
          </Button>
        </div>
      )}
    </main>
  );
}
