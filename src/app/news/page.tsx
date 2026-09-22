import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { BriefList } from "@/components/news/brief-list";
import { CategoryRail } from "@/components/news/category-rail";
import { LeadStory } from "@/components/news/lead-story";
import { Masthead } from "@/components/news/masthead";
import { SectionHead } from "@/components/news/section-head";
import { StoryGrid } from "@/components/news/story-grid";
import { getCategoryCounts, getPublishedArticles } from "@/lib/news/service";
import { todayInUlaanbaatar } from "@/lib/news/today";
import { categoryLabel, isNewsCategory } from "@/lib/news/types";

export const metadata: Metadata = {
  title: "Мэдээ",
  description:
    "Шунхлай ХХК-ийн мэдээ, сурвалжилга, зарлал: салбарын хөгжил, нийгмийн хариуцлага, хүний нөөцийн шинэчлэл.",
};

/**
 * The front page is always current.
 *
 * Two reasons it cannot be cached: the store is in this process, so a cached
 * render would keep showing the front page as it was before the editor's last
 * save; and the masthead prints today's date, which a cached page would freeze
 * on the day it was built.
 */
export const dynamic = "force-dynamic";

function read(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value) ?? "";
}

export default async function NewsPage({ searchParams }: PageProps<"/news">) {
  const params = await searchParams;
  const requested = read(params.category);
  const category = isNewsCategory(requested) ? requested : null;

  const [articles, counts, everything] = await Promise.all([
    getPublishedArticles({ category }),
    getCategoryCounts(),
    getPublishedArticles(),
  ]);

  // The lead is the editor's pick if they made one, and the newest story
  // otherwise. It is chosen here rather than by the sort because the sort is
  // chronological on purpose — a featured story is an editorial decision about
  // one slot, not a claim that it is the most recent thing that happened.
  // On a filtered desk the pick only applies if it belongs to that desk.
  const lead = articles.find((entry) => entry.featured) ?? articles[0];
  const rest = articles.filter((entry) => entry.id !== lead?.id);
  const columns = rest.slice(0, 6);
  const briefs = rest.slice(6);

  const deskName = category ? categoryLabel(category) : null;

  return (
    <main data-newsroom className="flex-1 bg-background pt-16 text-foreground">
      <Masthead storyCount={everything.length} today={todayInUlaanbaatar()} />
      <CategoryRail active={category} counts={counts} total={everything.length} />

      <div className="mx-auto max-w-6xl px-6 pb-20 lg:px-10">
        {lead ? (
          <>
            <section aria-labelledby="lead-heading" className="py-9 sm:py-12">
              <h2 id="lead-heading" className="sr-only">
                {deskName ? `${deskName} — гол мэдээ` : "Гол мэдээ"}
              </h2>
              <LeadStory article={lead} />
            </section>

            {columns.length > 0 && (
              <section aria-labelledby="more-heading" className="pb-12">
                <SectionHead
                  title={deskName ?? "Бусад мэдээ"}
                  note={`${columns.length + briefs.length} мэдээ`}
                  className="mb-7"
                />
                <h2 id="more-heading" className="sr-only">
                  Бусад мэдээ
                </h2>
                <StoryGrid articles={columns} />
              </section>
            )}

            {briefs.length > 0 && (
              <section aria-labelledby="archive-heading">
                <SectionHead title="Архив" className="mb-1" />
                <h2 id="archive-heading" className="sr-only">
                  Архив
                </h2>
                <BriefList articles={briefs} startAt={columns.length + 2} />
              </section>
            )}
          </>
        ) : (
          /* An empty desk is a real state — a category can have nothing in it —
             so it gets a ruled panel rather than a blank page. */
          <section className="border-y border-border py-section text-center">
            <p className="news-headline text-xl">
              {deskName
                ? `“${deskName}” бүлэгт мэдээ байхгүй байна.`
                : "Одоогоор мэдээ байхгүй байна."}
            </p>
            <p className="mt-2.5 text-sm text-muted-foreground">
              Шинэ мэдээ нийтлэгдэх үед энэ хуудсанд харагдана.
            </p>
            {deskName && (
              <Link
                href="/news"
                className="mt-5 inline-flex items-center gap-1.5 type-kicker font-semibold tracking-[0.14em] uppercase focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                style={{ color: "var(--paper-accent)" }}
              >
                <ArrowLeft aria-hidden className="size-3.5" />
                Бүх мэдээ
              </Link>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
