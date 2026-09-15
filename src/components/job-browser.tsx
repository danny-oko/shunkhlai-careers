"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, SlidersHorizontal } from "lucide-react";

import { FilterSelect } from "@/components/job-filters";
import {
  applyFacets,
  companyOptions,
  defaultFacets,
  facetBase,
  groupOptions,
  isFiltered,
  locationOptions,
  positionTypeOptions,
  salaryOptions,
  workTypeOptions,
  type JobFacets,
} from "@/lib/jobs/filters";
import { ALL, type Job } from "@/lib/jobs/types";
import type { JobFilterData } from "@/lib/api/jobs";
import { cn } from "@/lib/utils";
import { SectionRule } from "@/components/brand/section-rule";

/**
 * Every filter `getDropDownData` offers, in one rail.
 *
 * Two layers sit behind them, matching what the API actually supports.
 * Location and salary band go back to `getRecruitmentOrderList` through the
 * URL, so those results stay linkable and server-rendered. Position group,
 * company, position type and work type are refined over the rows already on
 * the page.
 *
 * Which side of that line a filter falls on is an implementation detail to
 * the candidate, so both layers are the same dropdown in the same rail.
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

  const locationId = params.get("locationid") ?? "";
  const salaryLevelId = params.get("salaryLevelID") ?? "";

  const visibleJobs = React.useMemo(() => applyFacets(jobs, facets), [jobs, facets]);
  const locations = React.useMemo(() => locationOptions(filterData), [filterData]);
  const salaryLevels = React.useMemo(() => salaryOptions(filterData), [filterData]);

  // Each client-side list is counted against what the *other* facets keep, so
  // a number reads as "what I get if I pick this".
  const lists = React.useMemo(
    () => ({
      group: groupOptions(filterData, facetBase(jobs, facets, "group")),
      company: companyOptions(filterData, facetBase(jobs, facets, "company")),
      positionType: positionTypeOptions(filterData, facetBase(jobs, facets, "positionType")),
      workType: workTypeOptions(jobs, facetBase(jobs, facets, "workType")),
    }),
    [jobs, facets, filterData],
  );

  /** Server-side filters live in the URL. */
  function pushQuery(next: Record<string, string>) {
    const query = new URLSearchParams(params.toString());
    for (const [key, value] of Object.entries(next)) {
      if (value) query.set(key, value);
      else query.delete(key);
    }
    const search = query.toString();
    router.push(search ? `/careers?${search}` : "/careers");
  }

  function clearEverything() {
    setFacets(defaultFacets);
    router.push("/careers");
  }

  const isAnyFilterOn = isFiltered(facets) || Boolean(locationId) || Boolean(salaryLevelId);

  const filterSections = (
    <>
      <FilterSelect
        label="Албан тушаалын бүлэг"
        options={lists.group}
        value={facets.group}
        onChange={(value) => setFacets((current) => ({ ...current, group: value }))}
      />
      <FilterSelect
        label="Байршил"
        options={locations}
        value={locationId || ALL}
        onChange={(value) => pushQuery({ locationid: value === ALL ? "" : value })}
      />
      <FilterSelect
        label="Цалингийн түвшин"
        options={salaryLevels}
        value={salaryLevelId || ALL}
        onChange={(value) => pushQuery({ salaryLevelID: value === ALL ? "" : value })}
      />
      <FilterSelect
        label="Компани"
        options={lists.company}
        value={facets.company}
        onChange={(value) => setFacets((current) => ({ ...current, company: value }))}
      />
      <FilterSelect
        label="Ажлын хэлбэр"
        options={lists.positionType}
        value={facets.positionType}
        onChange={(value) => setFacets((current) => ({ ...current, positionType: value }))}
      />
      <FilterSelect
        label="Ажлын төрөл"
        options={lists.workType}
        value={facets.workType}
        onChange={(value) => setFacets((current) => ({ ...current, workType: value }))}
      />
    </>
  );

  return (
    <div className="relative">
      <SectionRule />

      {/* Mobile: the facet tree collapses behind a single toggle. */}
      <div className="border-b border-border/70 px-6 py-4 lg:hidden">
        <button
          type="button"
          onClick={() => setIsPanelOpen((open) => !open)}
          aria-expanded={isPanelOpen}
          className="inline-flex items-center gap-2 rounded-full border border-border/70 px-4 py-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <SlidersHorizontal className="size-3.5" />
          Шүүлтүүр
          {isAnyFilterOn ? (
            <span className="size-1.5 rounded-full bg-primary" />
          ) : null}
        </button>
      </div>

      <div className="grid lg:grid-cols-[minmax(0,17.5rem)_minmax(0,1fr)]">
        <aside
          className={cn(
            "border-b border-border/70 lg:border-r lg:border-b-0",
            isPanelOpen ? "block" : "hidden lg:block",
          )}
        >
          <div className="lg:sticky lg:top-16">
            <div className="flex items-center justify-between gap-4 px-6 pt-6">
              <h2 className="text-[0.8125rem] font-semibold tracking-[-0.01em]">
                Шүүлтүүр
              </h2>
              {isAnyFilterOn ? (
                <button
                  type="button"
                  onClick={clearEverything}
                  className="rounded-full px-1 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  Цэвэрлэх
                </button>
              ) : null}
            </div>
            <div className="flex flex-col gap-4 px-6 py-5">{filterSections}</div>
          </div>
        </aside>

        <div>
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
            /* Keyed on the active facets so the entrance replays whenever the
               result set changes. */
            <ul
              key={`${facets.group}-${facets.company}-${facets.positionType}-${facets.workType}`}
            >
              {visibleJobs.map((job, index) => (
                <li
                  key={job.id}
                  style={{ animationDelay: `${Math.min(index, 6) * 60}ms` }}
                  className="brand-rise border-b border-border/70"
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
                    {/* "үлдсэн" is dropped under `sm`: at 390px the full phrase
                        takes enough width to wrap the job title beside it. */}
                    <span className="shrink-0 text-sm text-muted-foreground tabular-nums">
                      {job.isOpen ? (
                        <>
                          <span className="text-foreground font-medium">
                            {job.remainingDays}
                          </span>{" "}
                          хоног<span className="hidden sm:inline"> үлдсэн</span>
                        </>
                      ) : (
                        <>
                          <span className="hidden sm:inline">Хугацаа </span>дууссан
                        </>
                      )}
                    </span>
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
