"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Eye, ImageOff, Loader2, PencilLine, Save, Upload } from "lucide-react";

import { type ArticleActionState, saveArticleAction } from "@/app/admin/news/actions";
import { FieldShell } from "@/components/admin/field-shell";
import { ArticleBody } from "@/components/news/article-body";
import { Dateline } from "@/components/news/dateline";
import { Kicker } from "@/components/news/kicker";
import { Button } from "@/components/ui/button";
import { DatePicker } from "@/components/ui/date-picker";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { parseBody, serializeBody } from "@/lib/news/blocks";
import { ARTICLE_LIMITS, COVER_TYPES } from "@/lib/news/schema";
import {
  NEWS_CATEGORIES,
  type NewsArticle,
  type NewsCategory,
  coverUrl,
} from "@/lib/news/types";
import { cn } from "@/lib/utils";

/**
 * The editor.
 *
 * Two halves that are the same content twice: the form on the left, and on the
 * right the article exactly as `/news/[slug]` will render it — same
 * `ArticleBody`, same measure, same drop cap, same paper. That is the point of
 * building the body as a block array over a tiny text syntax rather than as
 * rich text: the preview is not an approximation of the output, it *is* the
 * output, so there is nothing for the two to disagree about.
 *
 * On a phone the two halves become one, behind a toggle — side by side at
 * 390px would give each of them 180px, which is no use to either.
 */

const BODY_HELP = [
  "## Дэд гарчиг",
  "> Ишлэл — Хэлсэн хүн",
  "- Жагсаалтын мөр",
].join("   ·   ");

type Draft = {
  title: string;
  lede: string;
  category: NewsCategory;
  author: string;
  publishedAt: string;
  coverAlt: string;
  body: string;
  status: "draft" | "published";
  featured: boolean;
};

/** Today in Ulaanbaatar, for a new article's default date. */
function today(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ulaanbaatar",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function initialDraft(article: NewsArticle | null, echoed?: Record<string, string>): Draft {
  // A rejected save echoes what was typed, and that wins over the stored
  // record: re-rendering the saved values would silently undo the edit the
  // editor just made.
  const base: Draft = article
    ? {
        title: article.title,
        lede: article.lede,
        category: article.category,
        author: article.author,
        publishedAt: article.publishedAt,
        coverAlt: article.coverAlt,
        body: serializeBody(article.body),
        status: article.status,
        featured: article.featured,
      }
    : {
        title: "",
        lede: "",
        category: "company",
        author: "",
        publishedAt: today(),
        coverAlt: "",
        body: "",
        status: "draft",
        featured: false,
      };

  if (!echoed) return base;

  return {
    ...base,
    title: echoed.title ?? base.title,
    lede: echoed.lede ?? base.lede,
    category: (echoed.category as NewsCategory) || base.category,
    author: echoed.author ?? base.author,
    publishedAt: echoed.publishedAt ?? base.publishedAt,
    coverAlt: echoed.coverAlt ?? base.coverAlt,
    body: echoed.body ?? base.body,
    status: echoed.status === "published" ? "published" : "draft",
    featured: echoed.featured === "on",
  };
}

export function ArticleForm({ article }: { article: NewsArticle | null }) {
  const [state, formAction, isPending] = React.useActionState<ArticleActionState, FormData>(
    saveArticleAction,
    {},
  );

  // The echo is read once, as the initial value, and that covers both paths:
  // with JavaScript the component never unmounts across a rejected save, so
  // this state already holds what was typed; without it, the server re-renders
  // the form and the echoed values are the only thing that remembers.
  const [draft, setDraft] = React.useState<Draft>(() =>
    initialDraft(article, state.values),
  );
  const [pane, setPane] = React.useState<"edit" | "preview">("edit");
  const [coverPreview, setCoverPreview] = React.useState<string | null>(null);
  const [removeCover, setRemoveCover] = React.useState(false);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  const errors = state.fieldErrors ?? {};
  const blocks = React.useMemo(() => parseBody(draft.body), [draft.body]);

  const storedCover = coverUrl(article?.coverKey ?? null);
  const shownCover = coverPreview ?? (removeCover ? null : storedCover);

  const onCoverChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    setCoverPreview(file ? URL.createObjectURL(file) : null);
    if (file) setRemoveCover(false);
  };

  return (
    <form action={formAction} className="flex flex-1 flex-col">
      {article && <input type="hidden" name="id" value={article.id} />}
      {/* The controls whose value lives in React state rather than in the
          input itself still have to reach the server. `status` is not among
          them: it comes from whichever submit button was pressed, which is
          both simpler and immune to the state-update-versus-submit race a
          hidden field here would have. */}
      <input type="hidden" name="category" value={draft.category} />
      {draft.featured && <input type="hidden" name="featured" value="on" />}
      {removeCover && <input type="hidden" name="removeCover" value="on" />}

      {/* --- action bar ------------------------------------------------- */}
      <div className="sticky top-14 z-30 border-b border-border bg-background/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-5 py-2.5 lg:px-8">
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/news">← Буцах</Link>
          </Button>

          <div className="ml-auto flex items-center gap-2">
            {/* Compact segmented toggle. Only needed below lg, where the two
                panes cannot both be on screen. */}
            <div className="flex items-center rounded-full border border-border p-0.5 lg:hidden">
              {(["edit", "preview"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPane(value)}
                  aria-pressed={pane === value}
                  className={cn(
                    "flex items-center gap-1 rounded-full px-2.5 py-1 text-[0.6875rem] transition-colors",
                    pane === value
                      ? "bg-foreground text-background"
                      : "text-muted-foreground",
                  )}
                >
                  {value === "edit" ? (
                    <PencilLine aria-hidden className="size-3" />
                  ) : (
                    <Eye aria-hidden className="size-3" />
                  )}
                  {value === "edit" ? "Бичих" : "Харах"}
                </button>
              ))}
            </div>

            <Button
              type="submit"
              size="sm"
              variant="outline"
              name="status"
              value="draft"
              disabled={isPending}
            >
              Ноороглох
            </Button>

            <Button
              type="submit"
              size="sm"
              name="status"
              value="published"
              disabled={isPending}
            >
              {isPending ? (
                <Loader2 aria-hidden className="animate-spin" />
              ) : (
                <Save aria-hidden />
              )}
              Нийтлэх
            </Button>
          </div>
        </div>

        {state.message && (
          <p
            role="alert"
            className="border-t border-destructive/30 bg-destructive/10 px-5 py-2 text-center text-[0.8125rem] text-destructive lg:px-8"
          >
            {state.message}
          </p>
        )}
      </div>

      {/* --- panes ------------------------------------------------------ */}
      <div className="mx-auto grid w-full max-w-6xl flex-1 gap-0 px-5 lg:grid-cols-2 lg:gap-0 lg:px-0">
        <div
          className={cn(
            "flex flex-col gap-6 py-8 lg:border-r lg:border-border lg:px-8",
            pane === "edit" ? "flex" : "hidden lg:flex",
          )}
        >
          <FieldShell
            id="title"
            label="Гарчиг"
            error={errors.title}
            value={draft.title}
            limit={ARTICLE_LIMITS.title}
          >
            <Textarea
              id="title"
              name="title"
              rows={2}
              required
              value={draft.title}
              onChange={(event) => set("title", event.target.value)}
              aria-invalid={errors.title ? true : undefined}
              aria-describedby={errors.title ? "title-error" : undefined}
              className="news-headline resize-none text-xl leading-tight"
            />
          </FieldShell>

          <FieldShell
            id="lede"
            label="Тэргүүн үг"
            hint="Гарчгийн доор гарах 1–3 өгүүлбэр. Мэдээний гол агуулгыг нэг харцаар дамжуулна."
            error={errors.lede}
            value={draft.lede}
            limit={ARTICLE_LIMITS.lede}
          >
            <Textarea
              id="lede"
              name="lede"
              rows={3}
              required
              value={draft.lede}
              onChange={(event) => set("lede", event.target.value)}
              aria-invalid={errors.lede ? true : undefined}
              className="resize-none"
            />
          </FieldShell>

          <div className="grid gap-5 sm:grid-cols-2">
            <FieldShell id="author" label="Нийтлэлч" error={errors.author}>
              <Input
                id="author"
                name="author"
                required
                value={draft.author}
                onChange={(event) => set("author", event.target.value)}
                aria-invalid={errors.author ? true : undefined}
                placeholder="Б. Энхжаргал"
              />
            </FieldShell>

            <FieldShell id="publishedAt" label="Огноо" error={errors.publishedAt}>
              <DatePicker
                id="publishedAt"
                name="publishedAt"
                value={draft.publishedAt}
                onChange={(next) => set("publishedAt", next)}
                aria-invalid={errors.publishedAt ? true : undefined}
              />
            </FieldShell>
          </div>

          {/* Four options, so a radio rail beats a select: every choice is
              visible and reachable in one press instead of two. */}
          <fieldset>
            <legend className="text-[0.6875rem] tracking-[0.14em] uppercase">
              Бүлэг
            </legend>
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {NEWS_CATEGORIES.map((category) => (
                <button
                  key={category.value}
                  type="button"
                  role="radio"
                  aria-checked={draft.category === category.value}
                  onClick={() => set("category", category.value)}
                  className={cn(
                    "rounded-full border px-3 py-1.5 text-[0.8125rem] transition-colors",
                    "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                    draft.category === category.value
                      ? "border-transparent bg-foreground font-medium text-background"
                      : "border-border text-foreground hover:bg-muted",
                  )}
                >
                  {category.label}
                </button>
              ))}
            </div>
            {errors.category && (
              <p role="alert" className="mt-2 text-[0.8125rem] text-destructive">
                {errors.category}
              </p>
            )}
          </fieldset>

          {/* --- cover --- */}
          <div className="flex flex-col gap-2.5 border-t border-border pt-6">
            <Label className="text-[0.6875rem] tracking-[0.14em] uppercase">
              Гол зураг
            </Label>

            <div className="flex items-start gap-4">
              <div className="relative size-24 shrink-0 overflow-hidden border border-border bg-muted">
                {shownCover ? (
                  <Image
                    src={shownCover}
                    alt=""
                    fill
                    sizes="96px"
                    // A blob: URL from the file picker is not a route the
                    // image optimiser can fetch, so it is passed through.
                    unoptimized={Boolean(coverPreview)}
                    className="object-cover"
                  />
                ) : (
                  <div className="flex size-full items-center justify-center">
                    <ImageOff aria-hidden className="size-5 text-muted-foreground" />
                  </div>
                )}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Button asChild variant="outline" size="sm" className="w-fit">
                  <label>
                    <Upload aria-hidden />
                    Зураг сонгох
                    <input
                      type="file"
                      name="cover"
                      accept={COVER_TYPES.join(",")}
                      onChange={onCoverChange}
                      className="sr-only"
                    />
                  </label>
                </Button>

                <p className="text-[0.75rem] leading-snug text-muted-foreground">
                  JPEG, PNG, WebP, AVIF · 5MB хүртэл
                </p>

                {storedCover && !coverPreview && (
                  <label className="flex w-fit items-center gap-2 text-[0.75rem] text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={removeCover}
                      onChange={(event) => setRemoveCover(event.target.checked)}
                      className="size-3.5 accent-[var(--paper-accent)]"
                    />
                    Одоогийн зургийг хасах
                  </label>
                )}

                {errors.cover && (
                  <p role="alert" className="text-[0.8125rem] text-destructive">
                    {errors.cover}
                  </p>
                )}
              </div>
            </div>

            <FieldShell
              id="coverAlt"
              label="Зургийн тайлбар"
              hint="Зураг харагдахгүй үед, мөн дэлгэц уншигчид уншина. Гарчгийг давтахаас зайлсхий."
              error={errors.coverAlt}
              value={draft.coverAlt}
              limit={ARTICLE_LIMITS.coverAlt}
              className="mt-2"
            >
              <Input
                id="coverAlt"
                name="coverAlt"
                value={draft.coverAlt}
                onChange={(event) => set("coverAlt", event.target.value)}
                aria-invalid={errors.coverAlt ? true : undefined}
              />
            </FieldShell>
          </div>

          {/* --- body --- */}
          <FieldShell
            id="body"
            label="Мэдээний бичвэр"
            hint={BODY_HELP}
            error={errors.body}
            value={draft.body}
            limit={ARTICLE_LIMITS.body}
            className="border-t border-border pt-6"
          >
            <Textarea
              id="body"
              name="body"
              rows={18}
              required
              value={draft.body}
              onChange={(event) => set("body", event.target.value)}
              aria-invalid={errors.body ? true : undefined}
              className="font-mono text-[0.8125rem] leading-relaxed"
            />
          </FieldShell>

          <div className="flex items-start justify-between gap-4 border-t border-border pt-6">
            <div>
              <Label htmlFor="featured" className="text-[0.8125rem] font-medium">
                Гол мэдээ
              </Label>
              <p className="mt-1 max-w-xs text-[0.75rem] leading-snug text-muted-foreground">
                Нүүр хуудсын хамгийн том байрлалд гарна. Зөвхөн нэг мэдээ гол
                байж чадна.
              </p>
            </div>
            <Switch
              id="featured"
              checked={draft.featured}
              onCheckedChange={(checked) => set("featured", checked)}
            />
          </div>
        </div>

        {/* --- preview --- */}
        <div
          className={cn(
            "py-8 lg:px-8",
            pane === "preview" ? "block" : "hidden lg:block",
          )}
        >
          <p className="mb-6 flex items-center gap-1.5 text-[0.625rem] tracking-[0.16em] text-muted-foreground uppercase">
            <Eye aria-hidden className="size-3" />
            Уншигчид харагдах байдал
          </p>

          <article className="border-t-2 border-t-[var(--rule-strong)] pt-7">
            <Kicker category={draft.category} />

            <h2 className="news-headline mt-3 text-[clamp(1.5rem,3.4vw,2.125rem)]">
              {draft.title || "Гарчиг оруулаагүй"}
            </h2>

            {draft.lede && (
              <p className="news-body mt-4 text-muted-foreground">{draft.lede}</p>
            )}

            <Dateline
              article={{
                ...(article ?? ({} as NewsArticle)),
                author: draft.author || "Нийтлэлч",
                publishedAt: draft.publishedAt,
                body: blocks,
              }}
              long
              showReading
              className="mt-5"
            />

            {shownCover && (
              <div className="relative mt-6 aspect-[16/9] overflow-hidden border border-border bg-muted">
                <Image
                  src={shownCover}
                  alt={draft.coverAlt}
                  fill
                  sizes="(min-width: 1024px) 45vw, 90vw"
                  unoptimized={Boolean(coverPreview)}
                  className="object-cover"
                />
              </div>
            )}

            <div className="mt-7">
              {blocks.length > 0 ? (
                <ArticleBody blocks={blocks} />
              ) : (
                <p className="text-sm text-muted-foreground">
                  Бичвэр оруулахад энд харагдана.
                </p>
              )}
            </div>
          </article>
        </div>
      </div>
    </form>
  );
}
