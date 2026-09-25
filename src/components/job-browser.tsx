"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, SlidersHorizontal } from "lucide-react";

import { FilterSection, JobSearch } from "@/components/job-filters";
import { cn } from "@/lib/utils";
import {
  applyFacets,
  companyOptions,
  companyRows,
  defaultFacets,
  groupOptions,
  locationOptions,
  positionTypeOptions,
  salaryOptions,
  workTypeOptions,
  type JobFacets,
} from "@/lib/jobs/filters";
import { ALL, type Job } from "@/lib/jobs/types";
import type { JobFilterData } from "@/lib/api/jobs";
import { SectionRule } from "@/components/brand/section-rule";
import { ActiveFilterChips } from "@/components/job-filter-chips";
import {
  buildActiveFilters,
  type FilterKey,
} from "@/components/job-filter-state";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

/**
 * Two filter layers, matching what the API actually supports.
 *
 * Position name, location and salary band go back to
 * `getRecruitmentOrderList` through the URL, so results stay linkable and
 * server-rendered. Position group, company, position type and work type are
 * refined over the rows already on the page.
 *
 * Which side of that line a filter falls on is an implementation detail to the
 * candidate, so both layers are the same pills in the same rail.
 */
export function JobBrowser({
  jobs,
  filterData,
}: {
  jobs: Job[];
  filterData: JobFilterData | null;
}) {
  const router = useRouter();
  const params = useSearchParams();

  const [facets, setFacets] = React.useState<JobFacets>(defaultFacets);
  const [isPanelOpen, setIsPanelOpen] = React.useState(false);
  // A URL filter waits on the server; until it lands the old list stays, dimmed.
  const [isPending, startTransition] = React.useTransition();
  // The first paint gets the full entrance; a filter change only a short settle.
  const [hasFiltered, setHasFiltered] = React.useState(false);
  const resultsRef = React.useRef<HTMLDivElement>(null);

  const jobName = params.get("jobName") ?? "";
  const locationId = params.get("locationid") ?? "";
  const salaryLevelId = params.get("salaryLevelID") ?? "";

  // All the refined lists come from `getDropDownData`, which the page already
  // fetched: the same call that feeds the location and salary rails.
  const companyList = React.useMemo(() => companyRows(filterData), [filterData]);
  const visibleJobs = React.useMemo(
    () => applyFacets(jobs, facets, companyList),
    [jobs, facets, companyList],
  );
  // The selected value is passed in so a facet that has fallen to zero — after
  // a search, say — keeps its row and stays clearable.
  const groups = React.useMemo(
    () => groupOptions(filterData, jobs, facets.group),
    [filterData, jobs, facets.group],
  );
  const companies = React.useMemo(() => companyOptions(filterData, jobs), [filterData, jobs]);
  const positionTypes = React.useMemo(
    () => positionTypeOptions(filterData, jobs, facets.positionType),
    [filterData, jobs, facets.positionType],
  );
  const workTypes = React.useMemo(() => workTypeOptions(jobs), [jobs]);
  const locations = React.useMemo(() => locationOptions(filterData), [filterData]);
  const salaryLevels = React.useMemo(() => salaryOptions(filterData), [filterData]);

  /**
   * A filter reshapes the list under the reader. Scrolled past its start, they
   * would be left mid-way through a list they have not seen, so it glides back
   * to the first result — never to the top of the page, and not at all when
   * the start is already in view.
   */
  function onFilterChange() {
    setHasFiltered(true);
    const results = resultsRef.current;
    if (!results || results.getBoundingClientRect().top >= 0) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    results.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }

  /** Server-side filters live in the URL. `scroll: false` stops Next.js
      jumping to the top of the page on every choice. */
  function navigate(href: string) {
    onFilterChange();
    startTransition(() => router.push(href, { scroll: false }));
  }

  function pushQuery(next: Record<string, string>) {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    const search = query.toString();
    navigate(search ? `/careers?${search}` : "/careers");
  }

  /** Client-side facets refine the rows already on the page. */
  function setFacet(key: keyof JobFacets, value: string) {
    onFilterChange();
    setFacets((current) => ({ ...current, [key]: value }));
  }

  function clearEverything() {
    setFacets(defaultFacets);
    navigate("/careers");
  }

  const activeFilters = buildActiveFilters({
    facets,
    jobName,
    locationId,
    salaryLevelId,
    groups,
    companies,
    positionTypes,
    workTypes,
    locations,
    salaryLevels,
  });
  const activeCount = activeFilters.length;
  const resultLabel = `${visibleJobs.length} ажлын байр`;

  /** Chips remove exactly one filter through the same handlers as the rows. */
  function removeFilter(key: FilterKey) {
    if (key === "search") pushQuery({ jobName: "" });
    else if (key === "location") pushQuery({ locationid: "" });
    else if (key === "salary") pushQuery({ salaryLevelID: "" });
    else setFacet(key, ALL);
  }

  // The drawer is a phone affordance: close it if the viewport grows to the
  // desktop layout, where the same filters are already in the sidebar.
  React.useEffect(() => {
    const query = window.matchMedia("(min-width: 1024px)");
    const onChange = () => query.matches && setIsPanelOpen(false);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  const filterSections = (
    <>
      <FilterSection
        title="Албан тушаалын бүлэг"
        options={groups}
        value={facets.group}
        onChange={(value) => setFacet("group", value)}
        defaultOpen
      />
      <FilterSection
        title="Байршил"
        options={locations}
        value={locationId || ALL}
        onChange={(value) => pushQuery({ locationid: value === ALL ? "" : value })}
      />
      <FilterSection
        title="Цалингийн түвшин"
        options={salaryLevels}
        value={salaryLevelId || ALL}
        onChange={(value) =>
          pushQuery({ salaryLevelID: value === ALL ? "" : value })
        }
      />
      <FilterSection
        title="Компани"
        options={companies}
        value={facets.company}
        onChange={(value) => setFacet("company", value)}
      />
      <FilterSection
        title="Ажиллах хэлбэр"
        options={positionTypes}
        value={facets.positionType}
        onChange={(value) => setFacet("positionType", value)}
      />
      <FilterSection
        title="Ажлын төрөл"
        options={workTypes}
        value={facets.workType}
        onChange={(value) => setFacet("workType", value)}
      />
    </>
  );

  return (
    <div className="relative">
      <SectionRule />

      {/* The one filter the API searches on by text, above both layouts: on a
          phone it must not be hidden behind the drawer. */}
      <div className="border-b border-border/70 px-6 py-3 sm:px-10 lg:px-10">
        <div className="max-w-md">
          <JobSearch
            value={jobName}
            onChange={(value) => pushQuery({ jobName: value })}
          />
        </div>
      </div>

      {/* Mobile: filters open in a bottom drawer. Its open state lives here,
          and the Sheet sits outside the keyed results list, so the router.push
          a location or salary choice triggers does not remount it. */}
      <div className="flex items-center justify-between gap-3 border-b border-border/70 px-6 py-3 lg:hidden">
        <button
          type="button"
          onClick={() => setIsPanelOpen(true)}
          aria-haspopup="dialog"
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-border/70 px-4 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <SlidersHorizontal className="size-3.5" />
          Шүүлтүүр{activeCount > 0 ? ` (${activeCount})` : ""}
        </button>
        <span
          aria-live="polite"
          className="text-sm text-muted-foreground tabular-nums"
        >
          {resultLabel}
        </span>
      </div>

      <Sheet open={isPanelOpen} onOpenChange={setIsPanelOpen}>
        <SheetContent
          side="bottom"
          className="max-h-[85dvh] gap-0 rounded-t-2xl p-0 lg:hidden"
        >
          <SheetHeader className="flex-row items-center justify-between gap-3 border-b border-border/70 py-3 pr-14 pl-5">
            <SheetTitle>Шүүлтүүр</SheetTitle>
            <SheetDescription className="sr-only">
              Ажлын байрыг шүүх сонголтууд
            </SheetDescription>
            {activeCount > 0 && (
              <button
                type="button"
                onClick={clearEverything}
                className="min-h-11 rounded-full px-3 text-sm font-medium text-primary hover:bg-primary/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                Цэвэрлэх
              </button>
            )}
          </SheetHeader>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {filterSections}
          </div>
          <SheetFooter className="border-t border-border/70 bg-popover p-4">
            <button
              type="button"
              onClick={() => setIsPanelOpen(false)}
              aria-live="polite"
              className="min-h-12 w-full rounded-full bg-primary px-5 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              {visibleJobs.length} ажлын байр харах
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <div className="grid lg:grid-cols-[minmax(0,17.5rem)_minmax(0,1fr)]">
        <aside className="hidden border-border/70 lg:block lg:border-r">
          <div className="lg:sticky lg:top-16">
            <div className="flex min-h-14 items-center justify-between gap-3 border-b border-border/70 px-5 py-3 lg:pl-10">
              <div className="min-w-0">
                <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em]">
                  Шүүлтүүр
                </h2>
                <p
                  aria-live="polite"
                  className="text-xs text-muted-foreground tabular-nums"
                >
                  {resultLabel}
                </p>
              </div>
              {activeCount > 0 && (
                <button
                  type="button"
                  onClick={clearEverything}
                  className="rounded-full px-3 py-1.5 text-sm font-medium text-primary transition-colors hover:bg-primary/10 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  Цэвэрлэх
                </button>
              )}
            </div>
            {filterSections}
          </div>
        </aside>

        {/* scroll-mt clears the fixed site header. */}
        <div
          ref={resultsRef}
          aria-busy={isPending}
          className="scroll-mt-16"
        >
          <ActiveFilterChips
            filters={activeFilters}
            onRemove={removeFilter}
            onClearAll={clearEverything}
          />
          {visibleJobs.length === 0 ? (
            <div className="px-6 py-24 text-center sm:px-10">
              <p className="text-base font-medium">Тохирох ажлын байр олдсонгүй</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Шүүлтүүрээ өргөжүүлж үзнэ үү.
              </p>
              <button
                type="button"
                onClick={clearEverything}
                className="mt-6 rounded-full border border-border/70 px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                Шүүлтүүр цэвэрлэх
              </button>
            </div>
          ) : (
            /* Keyed on every active filter so each new result set settles in
               the same way, whichever layer produced it. */
            <ul
              key={`${params.toString()}|${facets.group}-${facets.company}-${facets.positionType}-${facets.workType}`}
              className={cn(
                "transition-opacity duration-200",
                isPending && "opacity-50",
              )}
            >
              {visibleJobs.map((job, index) => (
                <li
                  key={job.id}
                  style={{
                    animationDelay: `${Math.min(index, 6) * (hasFiltered ? 30 : 60)}ms`,
                  }}
                  className={cn(
                    hasFiltered ? "brand-settle" : "brand-rise",
                    "border-b border-border/70",
                  )}
                >
                  <Link
                    href={`/careers/${job.slug}`}
                    className="group relative isolate flex items-center justify-between gap-6 px-6 py-8 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:-outline-offset-2 sm:px-10 sm:py-10"
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-2 inset-y-2 -z-10 rounded-xl bg-muted/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100 sm:inset-x-4 sm:inset-y-3"
                    />

                    {/* Work type and position group are both sidebar facets, so
                        repeating them per row restates the filter the reader
                        just used. What is left is identity on the left and the
                        one thing that expires on the right. */}
                    <div className="min-w-0">
                      <h2 className="flex items-center gap-1.5 text-lg font-medium tracking-[-0.02em] sm:text-xl">
                        {job.title}
                        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
                      </h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {[job.company, job.location].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {/* A `span`, not a `Button` — the whole row is already the
                        link, and an anchor inside an anchor is invalid markup
                        that screen readers and middle-click both trip over.
                        This is the affordance only: it says the row leads
                        somewhere, and the click it appears to accept is the
                        one the row was always accepting.

                        A closed advert keeps its own word instead, because
                        "Дэлгэрэнгүй" on something nobody can apply to reads
                        as an invitation. Its precise status (in selection,
                        selection finished) stays the tooltip — the column is
                        too narrow for the sentence. */}
                    {job.isOpen ? (
                      <span className="shrink-0 rounded-full border border-border px-3.5 py-2 text-[0.8125rem] font-medium text-muted-foreground transition-colors duration-200 group-hover:border-foreground/30 group-hover:text-foreground">
                        Дэлгэрэнгүй
                      </span>
                    ) : (
                      <span
                        title={job.status}
                        className="shrink-0 text-sm text-muted-foreground"
                      >
                        Хаагдсан
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
