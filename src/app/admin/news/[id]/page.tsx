import { notFound } from "next/navigation";

import { ArticleForm } from "@/components/admin/article-form";
import { getAdminArticle } from "@/lib/news/service";
import { NEWS_DB_ERROR } from "@/lib/news/schema";
import type { NewsArticle } from "@/lib/news/types";

export const dynamic = "force-dynamic";

export default async function EditArticlePage({
  params,
}: PageProps<"/admin/news/[id]">) {
  const { id } = await params;

  // `getAdminArticle` reads any status, because the whole point of the edit
  // screen is to be able to open a draft. The layout above has already run
  // `requireAdmin()`, so reaching this line means the request is authorised.
  let article: NewsArticle | null;
  try {
    article = await getAdminArticle(id);
  } catch (error) {
    console.error(
      "[admin/news] D1 read failed:",
      error instanceof Error ? error.message : error,
    );
    return (
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-8 lg:px-8">
        <p
          role="alert"
          className="border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-[0.8125rem] text-destructive"
        >
          {NEWS_DB_ERROR}
        </p>
      </main>
    );
  }
  if (!article) notFound();

  return <ArticleForm article={article} />;
}
