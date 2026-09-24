import { AlertTriangle } from "lucide-react";

import {
  AboutStatsForm,
  FooterForm,
  HeroForm,
} from "@/components/admin/content/section-forms";
import { CONTENT_SECTIONS } from "@/lib/content/defaults";
import { loadSectionsForAdmin, type AdminSections } from "@/lib/content/service";
import { CONTENT_DB_ERROR, CONTENT_KEYS } from "@/lib/content/schema";

/**
 * The content desk: the marketing copy of `/` and `/about`, and the foot of
 * every page, in three forms.
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
 * The three sections, as a rail of jumps.
 *
 * The page is three tall panels and cannot usefully be made shorter — every
 * field on it is a field somebody has to be able to edit. What it can have is
 * a way in: the rail says how many sections there are and puts each one a
 * click away, which is the thing the earlier single scroll withheld. It
 * sticks under the shell's chrome (`--admin-bar-h`, zero beside the sidebar)
 * so it is still there halfway down the footer.
 *
 * Styled as the newsroom desk's own filter pills, because it does the same
 * job one screen over and the desk should not have two vocabularies for
 * "pick one of these".
 */
function SectionRail() {
  return (
    <nav
      aria-label="Хуудасны контент"
      className="sticky top-[var(--admin-bar-h,0px)] z-20 -mx-5 mt-4 flex flex-wrap items-center gap-1.5 border-b border-border bg-background/95 px-5 py-2.5 backdrop-blur-md lg:-mx-8 lg:px-8"
    >
      {CONTENT_KEYS.map((key) => (
        <a
          key={key}
          href={`#${key}`}
          className="rounded-full border border-border px-2.5 py-1 text-[0.6875rem] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          {CONTENT_SECTIONS[key].title}
        </a>
      ))}
    </nav>
  );
}

export default async function AdminContentPage() {
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

      {sections ? (
        <>
          <SectionRail />

          {/* Spaced apart rather than divided by a hairline: each panel is its
              own form and its own all-or-nothing save, and the gap is what
              says so before the save bar has to. */}
          <div className="mt-6 flex flex-col gap-10 pb-10">
            <HeroForm value={sections.hero.value} stored={sections.hero.stored} />
            <FooterForm value={sections.footer.value} stored={sections.footer.stored} />
            <AboutStatsForm
              value={sections.about_stats.value}
              stored={sections.about_stats.stored}
            />
          </div>
        </>
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
