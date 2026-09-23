import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Rise } from "@/components/brand/rise";
import { ArticleBody } from "@/components/news/article-body";
import { Dateline } from "@/components/news/dateline";
import { Kicker } from "@/components/news/kicker";
import { NewsCover } from "@/components/news/news-cover";
import { ReadingProgress } from "@/components/news/reading-progress";
import { SectionHead } from "@/components/news/section-head";
import { StoryGrid } from "@/components/news/story-grid";
import { StoryNav } from "@/components/news/story-nav";
import {
  getAdjacent,
  getArticle,
  getLatestForRelated,
} from "@/lib/news/service";
import { bodyExcerpt, categoryLabel, coverUrl } from "@/lib/news/types";

/**
 * Read from D1 on every request. The row can change from any host — an edit
 * saved on localhost writes the same database production reads — and only a
 * per-request read is guaranteed to see it; the admin actions' revalidatePath
 * cannot reach another host's cache.
 */
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: PageProps<"/news/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const article = await getArticle(slug);
  if (!article) return { title: "Мэдээ олдсонгүй" };

  // A hosted cover is already absolute and is handed to Open Graph as-is —
  // crawlers fetch it from Cloudinary directly. A media-route path is relative
  // and resolved against the site's `metadataBase`.
  const image = coverUrl(article.coverKey);

  return {
    title: article.title,
    description: article.lede || bodyExcerpt(article.body),
    openGraph: {
      type: "article",
      title: article.title,
      description: article.lede,
      publishedTime: article.publishedAt,
      authors: [article.author],
      images: image ? [{ url: image, alt: article.coverAlt }] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: PageProps<"/news/[slug]">) {
  const { slug } = await params;
  const article = await getArticle(slug);

  // `getArticle` returns published only, so a draft's URL 404s for everyone —
  // including the editor who knows it, which is the point of a draft.
  if (!article) notFound();

  const [{ previous, next }, related] = await Promise.all([
    getAdjacent(slug),
    getLatestForRelated(slug, article.category),
  ]);

  return (
    <main
      data-newsroom
      className="flex-1 bg-background pt-16 text-foreground"
    >
      <ReadingProgress />

      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        {/* Back to the front page, on the line the content starts on. */}
        <div className="border-b border-border py-3">
          <Link
            href="/news"
            className="inline-flex items-center gap-1.5 type-kicker tracking-[0.14em] text-muted-foreground uppercase transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ArrowLeft aria-hidden className="size-3" />
            Бүх мэдээ
          </Link>
        </div>

        <article>
          {/* The headline block is centred and capped narrower than the body,
              so a long Mongolian headline breaks into two or three balanced
              lines instead of one that runs the full width of the page. */}
          <header className="mx-auto max-w-3xl pt-10 pb-8 text-center sm:pt-14">
            {/* The front page's stagger, on the piece it leads to. */}
            <Rise>
              <Kicker category={article.category} />
            </Rise>

            <Rise delay={90}>
              <h1 className="news-headline mt-4 text-[clamp(1.875rem,5.5vw,3.25rem)]">
                {article.title}
              </h1>
            </Rise>

            {article.lede && (
              <Rise delay={180}>
                <p className="news-body mx-auto mt-5 max-w-2xl text-muted-foreground">
                  {article.lede}
                </p>
              </Rise>
            )}

            <Rise delay={260}>
              <Dateline
                article={article}
                long
                showReading
                className="mt-6 justify-center"
              />
            </Rise>
          </header>

          {article.coverKey && (
            <figure className="mb-10">
              <NewsCover
                coverKey={article.coverKey}
                alt={article.coverAlt}
                ratio="16 / 9"
                priority
                sizes="(min-width: 1152px) 1088px, 100vw"
              />
              {article.coverAlt && (
                <figcaption className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                  {article.coverAlt}
                </figcaption>
              )}
            </figure>
          )}

          <div className="pb-14">
            <ArticleBody doc={article.body} />
          </div>

          <footer className="news-measure mx-auto pb-12">
            <p className="flex flex-wrap items-center gap-x-2 border-t border-border pt-4 type-kicker tracking-[0.14em] text-muted-foreground uppercase">
              <Link
                href={`/news?category=${article.category}`}
                className="underline underline-offset-4 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                {categoryLabel(article.category)}
              </Link>
              <span aria-hidden>·</span>
              {article.author}
            </p>
          </footer>
        </article>
      </div>

      <StoryNav previous={previous} next={next} />

      {related.length > 0 && (
        <section
          aria-labelledby="related-heading"
          className="mx-auto max-w-6xl px-6 py-12 lg:px-10"
        >
          <SectionHead title="Уншиж болох мэдээ" className="mb-7" />
          <h2 id="related-heading" className="sr-only">
            Уншиж болох мэдээ
          </h2>
          <StoryGrid articles={related} />
        </section>
      )}
    </main>
  );
}
