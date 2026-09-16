import { ArticleForm } from "@/components/admin/article-form";

export const dynamic = "force-dynamic";

/** A blank article. `null` is what tells the form it is creating, not editing. */
export default function NewArticlePage() {
  return <ArticleForm article={null} />;
}
