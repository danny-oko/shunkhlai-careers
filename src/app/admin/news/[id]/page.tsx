import { notFound } from "next/navigation";

import { ArticleForm } from "@/components/admin/article-form";
import { getAdminArticle } from "@/lib/news/service";

export const dynamic = "force-dynamic";

export default async function EditArticlePage({
  params,
}: PageProps<"/admin/news/[id]">) {
  const { id } = await params;

  // `getAdminArticle` reads any status, because the whole point of the edit
  // screen is to be able to open a draft. The layout above has already run
  // `requireAdmin()`, so reaching this line means the request is authorised.
  const article = await getAdminArticle(id);
  if (!article) notFound();

  return <ArticleForm article={article} />;
}
