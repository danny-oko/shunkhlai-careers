import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";

import { Rise } from "@/components/brand/rise";
import { ArticleBody } from "@/components/news/article-body";
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
import {
  bodyExcerpt,
  categoryLabel,
  coverUrl,
  formatNewsDate,
  readingMinutes,
} from "@/lib/news/types";

/**
 * What the headline stands on.
 *
 * Deep at the foot and gone by the middle of the frame, so the picture is
 * still a picture: over a blown-out sky the strongest stop leaves 14% of it
 * showing, which is 5.2:1 under white and holds the kicker as well as the
 * title.
 */
const HEADLINE_SCRIM =
  "linear-gradient(to top, rgba(0,0,0,0.86) 0%, rgba(0,0,0,0.72) 26%, rgba(0,0,0,0.3) 55%, rgba(0,0,0,0) 85%)";

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
          {article.coverKey ? (
            /* The headline is set on the picture rather than over it: the
               kicker and the title stand in the foot of the frame, on a
               gradient deep enough that they hold over a white sky as well as
               over a dark workshop, since the cover is whatever the desk filed
               and nothing here can be assumed about it.

               A plain header rather than a figure: with the title in it the
               picture is the page's masthead, not an illustration beside the
               copy, and the alt line under it is a caption for the reader
               rather than the figure's own. */
            <header className="mt-8 mb-10">
              <div className="relative overflow-hidden">
                <NewsCover
                  coverKey={article.coverKey}
                  alt={article.coverAlt}
                  ratio="16 / 9"
                  priority
                  sizes="(min-width: 1152px) 1088px, 100vw"
                />

                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-0"
                  style={{ backgroundImage: HEADLINE_SCRIM }}
                />

                {/* In the corner rather than across the middle, and a size
                    down from the headline the page used to open on: over a
                    picture the type is read against something, so it wants to
                    sit where the frame is quietest and take no more room than
                    it needs. The desk it came off is in the table at the foot
                    and does not need saying twice. */}
                <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
                  <Rise delay={90}>
                    <h1 className="news-headline max-w-3xl text-[clamp(1.125rem,3.2vw,2.25rem)] text-white">
                      {article.title}
                    </h1>
                  </Rise>
                </div>
              </div>

              {article.coverAlt && (
                <p className="mt-2.5 text-xs leading-relaxed text-muted-foreground">
                  {article.coverAlt}
                </p>
              )}
            </header>
          ) : (
            /* A story filed without a cover still needs its headline, so it
               keeps the centred block the page used to open on. */
            <header className="mx-auto max-w-3xl pt-10 pb-8 text-center sm:pt-14">
              <Rise>
                <p className="news-kicker">{categoryLabel(article.category)}</p>
              </Rise>

              <Rise delay={90}>
                <h1 className="news-headline mt-4 text-[clamp(1.875rem,5.5vw,3.25rem)]">
                  {article.title}
                </h1>
              </Rise>
            </header>
          )}

          <div className="pb-14">
            <ArticleBody doc={article.body} />
          </div>

          {/* Everything the top of the page used to carry under the headline
              - who filed it, when, and how long it takes - set as a plain
              four-column table at the foot, where a reader who has finished
              the piece is the one who wants it. */}
          <footer className="pb-12">
            <dl className="grid grid-cols-2 gap-x-8 gap-y-5 border-t border-border pt-5 sm:grid-cols-4">
              {[
                {
                  label: "Бүлэг",
                  value: (
                    <Link
                      href={`/news?category=${article.category}`}
                      className="underline underline-offset-4 hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                    >
                      {categoryLabel(article.category)}
                    </Link>
                  ),
                },
                { label: "Сурвалжлагч", value: article.author },
                { label: "Огноо", value: formatNewsDate(article.publishedAt) },
                {
                  label: "Унших хугацаа",
                  value: `${readingMinutes(article.body)} мин`,
                },
              ].map((row) => (
                <div key={row.label}>
                  <dt className="type-kicker tracking-[0.14em] text-muted-foreground uppercase">
                    {row.label}
                  </dt>
                  <dd className="mt-1.5 text-sm text-foreground">{row.value}</dd>
                </div>
              ))}
            </dl>
          </footer>
        </article>
      </div>

      {/* In the page's own column, not bled to the window: the picture, the
          copy and the stories under it all stop at these edges, and a band
          running past them read as the footer starting early. */}
      <div className="mx-auto max-w-6xl px-6 lg:px-10">
        <StoryNav previous={previous} next={next} />
      </div>

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
