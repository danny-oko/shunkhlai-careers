import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";

import {
  AboutStatsForm,
  CultureForm,
  FooterForm,
  HeroForm,
  HistoryForm,
} from "@/components/admin/content/section-forms";
import { CONTENT_SECTIONS } from "@/lib/content/defaults";
import { loadSectionsForAdmin, type AdminSections } from "@/lib/content/service";
import {
  CONTENT_DB_ERROR,
  CONTENT_KEYS,
  isContentKey,
  type ContentKey,
} from "@/lib/content/schema";
import { cn } from "@/lib/utils";

/**
 * The content desk, one section per screen: the marketing copy of `/` and
 * `/about`, and the foot of every page, each at `/admin/content/<section>`.
 *
 * They used to be one long scroll of four panels, which read as a single form
 * and made the last of them a long way down. One section per screen keeps the
 * save bar unambiguous and the page short enough to see where it ends.
 *
 * `force-dynamic` for the same reason the newsroom desk has it — the values
 * shown are rows an admin may have changed a second ago on another machine,
 * and a cached desk would offer a form that overwrites an edit it never saw.
 */
export const dynamic = "force-dynamic";

/**
 * The stored sections, or null when the database could not be reached.
 *
 * Note what this does *not* do: fall back to the defaults. The public pages
 * do, because a reader is better served by last year's wording than by a
 * blank band. An admin is not — a form pre-filled with the fallback copy
 * looks exactly like a form pre-filled with the stored copy, and saving it
 * would quietly replace the real rows with the values the code ships.
 */
async function loadDesk(): Promise<AdminSections | null> {
  try {
    return await loadSectionsForAdmin();
  } catch (error) {
    console.error(
      "[admin/content] database read failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

/**
 * The sections, as tabs.
 *
 * Plain anchors rather than `<Link>`: a full navigation is what fires the
 * form's `beforeunload` guard, so switching tabs with unsaved edits asks
 * first instead of dropping them silently.
 *
 * Styled as the newsroom desk's own filter pills, because it does the same
 * job one screen over and the desk should not have two vocabularies for
 * "pick one of these".
 */
function SectionTabs({ current }: { current: ContentKey }) {
  return (
    <nav
      aria-label="Хуудасны контент"
      className="sticky top-[var(--admin-bar-h,0px)] z-20 -mx-5 mt-4 flex flex-wrap items-center gap-1.5 border-b border-border bg-background/95 px-5 py-2.5 backdrop-blur-md lg:-mx-8 lg:px-8"
    >
      {CONTENT_KEYS.map((key) => {
        const active = key === current;
        return (
          <a
            key={key}
            href={`/admin/content/${key}`}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full border px-2.5 py-1 text-[0.6875rem] transition-colors focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
              active
                ? "border-foreground bg-foreground font-medium text-background"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            {CONTENT_SECTIONS[key].title}
          </a>
        );
      })}
    </nav>
  );
}

function SectionForm({ section, sections }: { section: ContentKey; sections: AdminSections }) {
  switch (section) {
    case "hero":
      return <HeroForm value={sections.hero.value} stored={sections.hero.stored} />;
    case "footer":
      return <FooterForm value={sections.footer.value} stored={sections.footer.stored} />;
    case "history":
      return <HistoryForm value={sections.history.value} stored={sections.history.stored} />;
    case "about_stats":
      return (
        <AboutStatsForm
          value={sections.about_stats.value}
          stored={sections.about_stats.stored}
        />
      );
    case "culture":
      return <CultureForm value={sections.culture.value} stored={sections.culture.stored} />;
  }
}

export default async function AdminContentSectionPage({
  params,
}: PageProps<"/admin/content/[section]">) {
  const { section } = await params;
  if (!isContentKey(section)) notFound();

  const sections = await loadDesk();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 lg:px-8">
      <div className="border-b-2 border-b-[var(--rule-strong)] pb-4">
        <h1 className="news-headline text-2xl sm:text-3xl">Хуудасны контент</h1>
        <p className="mt-1.5 max-w-prose text-[0.8125rem] text-muted-foreground">
          Нүүр болон Бидний тухай хуудасны бичвэр, зураг, холбоо барих мэдээлэл.
          Хадгалсны дараа нийтийн хуудас дараагийн ачаалалтаар шинэчлэгдэнэ.
        </p>
      </div>

      <SectionTabs current={section} />

      {sections ? (
        <div className="mt-6 pb-10">
          <SectionForm section={section} sections={sections} />
        </div>
      ) : (
        <p
          role="alert"
          className="mt-6 flex items-center gap-2 border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-[0.8125rem] text-destructive"
        >
          <AlertTriangle aria-hidden className="size-4 shrink-0" />
          {CONTENT_DB_ERROR}
        </p>
      )}
    </main>
  );
}
