import { AlertTriangle } from "lucide-react";

import {
  AboutStatsForm,
  FooterForm,
  HeroForm,
} from "@/components/admin/content/section-forms";
import { loadSectionsForAdmin, type AdminSections } from "@/lib/content/service";
import { CONTENT_DB_ERROR } from "@/lib/content/schema";

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

export default async function AdminContentPage() {
  const sections = await loadDesk();

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 lg:px-8">
      <div className="border-b-2 border-b-[var(--rule-strong)] pb-4">
        <h1 className="news-headline text-2xl sm:text-3xl">Хуудасны контент</h1>
        <p className="mt-1.5 text-[0.8125rem] text-muted-foreground">
          Нүүр болон Бидний тухай хуудасны бичвэр, зураг, холбоо барих мэдээлэл.
          Хадгалсны дараа нийтийн хуудас дараагийн ачаалалтаар шинэчлэгдэнэ.
        </p>
      </div>

      {sections ? (
        <div className="mt-8 flex flex-col">
          <HeroForm value={sections.hero.value} stored={sections.hero.stored} />
          <FooterForm value={sections.footer.value} stored={sections.footer.stored} />
          <AboutStatsForm
            value={sections.about_stats.value}
            stored={sections.about_stats.stored}
          />
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
