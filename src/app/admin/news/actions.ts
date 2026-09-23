"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  NEWS_DB_ERROR,
  articleFieldErrors,
  articleFormSchema,
  chooseCover,
  coverFileError,
} from "@/lib/news/schema";
import { requireAdmin } from "@/server/admin/guard";
import {
  deleteArticle,
  dropMedia,
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
 *
 * Every write here lands in the application's PostgreSQL database. A failure
 * (network, credentials, missing DATABASE_URL) is logged and turned into
 * `NEWS_DB_ERROR` for the editor — or `?error=db` on the list — never a crash.
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
  "coverUrl",
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

function logDbError(action: string, error: unknown): void {
  console.error(`[admin/news] ${action} failed:`, error instanceof Error ? error.message : error);
}

/** Clears the lead flag from every article but `exceptId`. */
async function demoteFeatured(exceptId: string | null): Promise<void> {
  const incumbents = (await listArticles({ status: "all" })).filter(
    (row) => row.featured && row.id !== exceptId,
  );
  for (const other of incumbents) await saveArticle({ ...other, featured: false });
}

/**
 * Everything a changed article can show up on.
 *
 * The public pages and the desk are `force-dynamic` and read the database on
 * every request, so there is no server-side render cache for these calls to clear —
 * that is what makes an edit from *any* host (localhost writes the same rows
 * production reads) show up on the next load. What `revalidatePath` still
 * does from a server action is drop this browser's client router cache, so
 * the editor who just saved and then navigates back to `/news` or the story
 * sees the new version rather than the prefetched old one.
 *
 * Both slugs when a headline changed: the old URL now 404s and must not be
 * served from a cache as if the story still lived there. The home page has no
 * news block, so it is not listed.
 */
function revalidateNews(...slugs: Array<string | null | undefined>): void {
  revalidatePath("/news");
  for (const slug of new Set(slugs)) {
    if (slug) revalidatePath(`/news/${slug}`);
  }
  revalidatePath("/admin/news");
}

/**
 * Best effort: the save already failed, and the editor's message says so. If
 * the database is down this fails too, and the chunks stay as an orphan — which is why
 * it is logged and swallowed rather than allowed to replace the real error.
 */
async function discardUpload(key: string): Promise<void> {
  try {
    await dropMedia(key);
  } catch (error) {
    logDbError(`discard upload ${key}`, error);
  }
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

  const cover = formData.get("cover");
  const upload = cover instanceof File && cover.size > 0 ? cover : null;
  if (upload) {
    const problem = coverFileError(upload);
    if (problem) {
      return { message: "Хадгалж чадсангүй.", fieldErrors: { cover: problem }, values };
    }
  }

  let slug: string;
  let previousSlug: string | null = null;
  // The key of a cover uploaded by *this* save, so a failure after the upload
  // can take it back instead of leaving chunks no story points at.
  let uploadedKey: string | null = null;
  try {
    const existing = id ? await getArticleById(id) : null;
    if (id && !existing) {
      return { message: "Мэдээ олдсонгүй.", values };
    }
    previousSlug = existing?.slug ?? null;

    /**
     * File, URL, "remove", or nothing — `chooseCover` owns the order. The
     * difference matters to the store: a new key replaces the cover, `null`
     * clears it, and leaving `coverKey` out keeps the existing one, so "keep"
     * omits the key rather than setting it.
     */
    const choice = chooseCover({
      hasUpload: Boolean(upload),
      url: values.coverUrl,
      remove: parsed.data.removeCover,
      currentKey: existing?.coverKey ?? null,
    });
    if (choice.kind === "error") {
      return {
        message: "Хадгалж чадсангүй.",
        fieldErrors: { coverUrl: choice.message },
        values,
      };
    }

    let coverPatch: { coverKey?: string | null } = {};
    if (choice.kind === "upload" && upload) {
      const bytes = new Uint8Array(await upload.arrayBuffer());
      uploadedKey = await putMedia(bytes, upload.type);
      coverPatch = { coverKey: uploadedKey };
    } else if (choice.kind === "url") {
      coverPatch = { coverKey: choice.key };
    } else if (choice.kind === "remove") {
      coverPatch = { coverKey: null };
    }

    const { removeCover: _removeCover, ...fields } = parsed.data;

    // There is one lead slot, so promoting from the editor has to demote the
    // incumbent the same way the star in the list does. Done before the save so
    // the article being saved is never one of the ones demoted.
    if (fields.featured) await demoteFeatured(id);

    const article = await saveArticle({ id, ...fields, ...coverPatch });
    slug = article.slug;
  } catch (error) {
    logDbError("save", error);
    if (uploadedKey) await discardUpload(uploadedKey);
    return { message: NEWS_DB_ERROR, values };
  }

  revalidateNews(slug, previousSlug);
  redirect(`/admin/news?saved=${encodeURIComponent(slug)}`);
}

export async function deleteArticleAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  let deleted: string | null = null;
  try {
    const article = await getArticleById(id);
    if (article && (await deleteArticle(id))) deleted = article.slug;
  } catch (error) {
    logDbError("delete", error);
    redirect("/admin/news?error=db");
  }

  if (deleted) revalidateNews(deleted);
  redirect(deleted ? "/admin/news?deleted=1" : "/admin/news");
}

/** Publish or unpublish, from the list — the one edit worth doing in one click. */
export async function setStatusAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const status = formData.get("status") === "published" ? "published" : "draft";

  let slug: string | null = null;
  try {
    const article = await getArticleById(id);
    if (article) slug = (await saveArticle({ ...article, status })).slug;
  } catch (error) {
    logDbError("status", error);
    redirect("/admin/news?error=db");
  }

  if (slug) revalidateNews(slug);
  redirect("/admin/news");
}

/**
 * The front page has room for exactly one lead, so this is a radio and not a
 * checkbox: promoting a story demotes whichever one was there.
 */
export async function setFeaturedAction(formData: FormData): Promise<void> {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  const featured = formData.get("featured") === "on";

  let slug: string | null = null;
  try {
    const article = await getArticleById(id);
    if (article) {
      if (featured) await demoteFeatured(article.id);
      slug = (await saveArticle({ ...article, featured })).slug;
    }
  } catch (error) {
    logDbError("featured", error);
    redirect("/admin/news?error=db");
  }

  if (slug) revalidateNews(slug);
  redirect("/admin/news");
}
