import Link from "next/link";
import { AlertTriangle, Inbox } from "lucide-react";

import { FilterPills } from "@/components/admin/application-filters";
import { ApplicationRow } from "@/components/admin/application-row";
import { ApplicationSource } from "@/components/admin/application-source";
import { Button } from "@/components/ui/button";
import { requireAdmin } from "@/server/admin/guard";
import { type ApplicationDesk, loadApplicationDesk } from "@/server/applicant/application-desk";
import {
  ALL,
  applyFilter,
  filterHref,
  isFiltered,
  jobOptions,
  parseFilter,
  statusOptions,
} from "./filters";
import { deskStatus, filterLabel } from "./labels";

/**
 * Every application that has reached this site, newest first.
 *
 * It replaces the desk that was removed in `docs/applications.md` ("No screen,
 * for now"). That one listed only the rows that were stuck, which meant the
 * screen was empty on a good day and there was nowhere at all to answer "did
 * Батболд's application arrive". The retry machinery it was built on is
 * untouched and still lives in `server/applicant/stuck.ts`; this page is the
 * list around it.
 *
 * Read by `editor` and `admin` alike — the gate is `AdminShell` in the layout,
 * repeated below because a page is cheap to move and a page that relies on its
 * parent stops being safe the moment somebody does.
 *
 * Dynamic, never cached: a cached list of work-in-flight is worse than no
 * list, because it shows rows that have since gone through and hides ones that
 * have not.
 */
export const dynamic = "force-dynamic";

const DB_ERROR = "Мэдээллийн санд холбогдож чадсангүй. Хэсэг хүлээгээд дахин оролдоно уу.";

/**
 * The desk, or null when the database could not be reached.
 *
 * Note what this does *not* do: show an empty list. "Өргөдөл ирээгүй байна" and
 * "we could not read the table" look identical on screen and mean opposite
 * things, and only one of them is a reason to call somebody.
 */
async function loadDesk(): Promise<ApplicationDesk | null> {
  try {
    return await loadApplicationDesk();
  } catch (error) {
    console.error(
      "[admin/applications] database read failed:",
      error instanceof Error ? error.message : error,
    );
    return null;
  }
}

function DbError() {
  return (
    <p
      role="alert"
      className="mt-6 flex items-center gap-2 border border-destructive/30 bg-destructive/10 px-4 py-2.5 text-[0.8125rem] text-destructive"
    >
      <AlertTriangle aria-hidden className="size-4 shrink-0" />
      {DB_ERROR}
    </p>
  );
}

export default async function AdminApplicationsPage({
  searchParams,
}: PageProps<"/admin/applications">) {
  await requireAdmin();

  const params = await searchParams;
  const desk = await loadDesk();

  if (!desk) {
    return (
      <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 lg:px-8">
        <h1 className="news-headline text-2xl sm:text-3xl">Ирсэн өргөдөл</h1>
        <DbError />
      </main>
    );
  }

  const filter = parseFilter(params);
  const rows = applyFilter(desk.rows, filter);
  const attention = desk.rows.filter((row) => deskStatus(row.push) === "attention").length;

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 py-8 lg:px-8">
      <div className="border-b-2 border-b-[var(--rule-strong)] pb-4">
        <h1 className="news-headline text-2xl sm:text-3xl">Ирсэн өргөдөл</h1>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem] tracking-[0.1em] text-muted-foreground uppercase tabular-nums">
          <span className="flex items-center gap-1.5">
            <Inbox aria-hidden className="size-3" />
            {desk.rows.length} өргөдөл
          </span>
          {attention > 0 && (
            <span className="flex items-center gap-1.5 text-destructive">
              <AlertTriangle aria-hidden className="size-3" />
              {attention} анхаарал шаардлагатай
            </span>
          )}
        </p>
      </div>

      <ApplicationSource source={desk.source} />

      {/* The filters count against each other, so the numbers on the pills are
          the number of rows pressing them shows. Both rows are links: the
          whole state of the screen is in the URL and can be sent to somebody.

          Drawn only when there is something to filter — two pills reading
          "Бүгд 0" above an empty desk are chrome pretending to be a control. */}
      {(desk.rows.length > 0 || isFiltered(filter)) && (
        <div className="mt-5 flex flex-col gap-2">
          <FilterPills
            label="Төлвөөр шүүх"
            current={filter.status}
            options={statusOptions(desk.rows, filter, filterLabel)}
            href={(value) => filterHref(filter, { status: value as typeof filter.status })}
          />
          <FilterPills
            label="Ажлын байраар шүүх"
            current={filter.job}
            options={jobOptions(desk.rows, filter)}
            href={(value) => filterHref(filter, { job: value })}
          />
        </div>
      )}

      {rows.length > 0 ? (
        <ul className="mt-6 divide-y divide-border border-y border-border">
          {rows.map((row) => (
            <ApplicationRow key={row.key} row={row} />
          ))}
        </ul>
      ) : (
        <div className="mt-6 border-y border-border py-20 text-center">
          <p className="news-headline text-lg">
            {isFiltered(filter)
              ? "Энэ шүүлтэд тохирох өргөдөл алга."
              : "Өргөдөл ирээгүй байна."}
          </p>
          <p className="mx-auto mt-2 max-w-[44ch] text-[0.8125rem] text-muted-foreground">
            {isFiltered(filter)
              ? "Шүүлтээ өөрчилж эсвэл бүх өргөдлийг үзнэ үү."
              : "Нэр дэвшигч ажлын байрны зар дээрээс өргөдөл илгээмэгц энд харагдана."}
          </p>
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {isFiltered(filter) ? (
              <Button asChild variant="outline" size="sm">
                <Link href={filterHref(filter, { status: ALL, job: ALL })}>Бүх өргөдөл</Link>
              </Button>
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href="/careers" target="_blank" rel="noreferrer">
                  Нээлттэй ажлын байр харах
                </Link>
              </Button>
            )}
          </div>
        </div>
      )}
    </main>
  );
}
