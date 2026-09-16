"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { parseBody } from "@/lib/news/blocks";
import { articleFieldErrors, articleFormSchema, coverFileError } from "@/lib/news/schema";
import { requireAdmin } from "@/server/admin/guard";
import {
  deleteArticle,
  getArticleById,
  listArticles,
  putMedia,
  saveArticle,
} from "@/server/news/store";

/**
 * Every write the newsroom can do.
 *
 * `requireAdmin()` is the first statement in each one. The proxy already
 * redirected an unauthenticated *navigation*, but a server action is a POST to
 * a route the client knows the id of, so it has to refuse on its own — a
 * function that trusted the proxy would be an unauthenticated write endpoint.
 */

export type ArticleActionState = {
  ok?: boolean;
  /** Shown above the form. Mongolian, like everything the editor reads. */
  message?: string;
  fieldErrors?: Record<string, string>;
  /** Echoed back so a rejected save never costs the editor their typing. */
  values?: Record<string, string>;
};

/** Field names the form sends; kept here so the echo and the parse agree. */
const FIELDS = [
  "title",
  "lede",
  "category",
  "author",
  "publishedAt",
  "coverAlt",
  "body",
  "status",
  "featured",
  "removeCover",
] as const;

function readFields(formData: FormData): Record<string, string> {
  return Object.fromEntries(
    FIELDS.map((field) => [field, String(formData.get(field) ?? "")]),
  );
}

/** Clears the lead flag from every article but `exceptId`. */
function demoteFeatured(exceptId: string | null): void {
  const incumbents = listArticles({ status: "all" }).filter(
    (row) => row.featured && row.id !== exceptId,
  );
  for (const other of incumbents) saveArticle({ ...other, featured: false });
}

/** Both the front page and the story's own URL move when an article changes. */
function revalidateNews(slug?: string): void {
  revalidatePath("/news");
  if (slug) revalidatePath(`/news/${slug}`);
  revalidatePath("/admin/news");
}

export async function saveArticleAction(
  _previous: ArticleActionState,
  formData: FormData,
): Promise<ArticleActionState> {
  await requireAdmin();

  const values = readFields(formData);
  const parsed = articleFormSchema.safeParse(values);

  if (!parsed.success) {
    return {
      message: "Хадгалж чадсангүй. Доорх талбаруудыг шалгана уу.",
      fieldErrors: articleFieldErrors(parsed.error),
      values,
    };
  }

  const id = String(formData.get("id") ?? "").trim() || null;
  if (id && !getArticleById(id)) {
    return { message: "Мэдээ олдсонгүй.", values };
  }

  /**
   * Three outcomes, and the difference matters to the store: a new file
   * replaces the cover, a ticked "remove" clears it, and neither leaves the
   * existing one alone. `coverKey` is therefore omitted rather than set to
   * null in that last case.
   */
  const cover = formData.get("cover");
  let coverPatch: { coverKey?: string | null } = {};

  if (cover instanceof File && cover.size > 0) {
    const problem = coverFileError(cover);
    if (problem) {
      return { message: "Хадгалж чадсангүй.", fieldErrors: { cover: problem }, values };
    }
    const bytes = new Uint8Array(await cover.arrayBuffer());
    coverPatch = { coverKey: putMedia(bytes, cover.type) };
  } else if (parsed.data.removeCover) {
    coverPatch = { coverKey: null };
  }

  const { body, removeCover: _removeCover, ...fields } = parsed.data;

  // There is one lead slot, so promoting from the editor has to demote the
  // incumbent the same way the star in the list does. Done before the save so
  // the article being saved is never one of the ones demoted.
  if (fields.featured) demoteFeatured(id);

  const article = saveArticle({
    id,
    ...fields,
    body: parseBody(body),
    ...coverPatch,
  });

  revalidateNews(article.slug);
  redirect(`/admin/news?saved=${encodeURIComponent(article.slug)}`);
}

export async function deleteArticleAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const article = getArticleById(id);
  if (article) {
    deleteArticle(id);
    revalidateNews(article.slug);
  }

  redirect(article ? "/admin/news?deleted=1" : "/admin/news");
}

/** Publish or unpublish, from the list — the one edit worth doing in one click. */
export async function setStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const article = getArticleById(String(formData.get("id") ?? ""));
  const status = formData.get("status") === "published" ? "published" : "draft";

  if (article) {
    saveArticle({ ...article, status });
    revalidateNews(article.slug);
  }

  redirect("/admin/news");
}

/**
 * The front page has room for exactly one lead, so this is a radio and not a
 * checkbox: promoting a story demotes whichever one was there.
 */
export async function setFeaturedAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const article = getArticleById(String(formData.get("id") ?? ""));
  if (!article) redirect("/admin/news");

  const featured = formData.get("featured") === "on";

  if (featured) demoteFeatured(article.id);
  saveArticle({ ...article, featured });
  revalidateNews(article.slug);
  redirect("/admin/news");
}
