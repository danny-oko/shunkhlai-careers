"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowUpRight, SlidersHorizontal } from "lucide-react";

import { FilterSection } from "@/components/job-filters";
import {
  applyFacets,
  companyOptions,
  defaultFacets,
  groupOptions,
  isFiltered,
  locationOptions,
  salaryOptions,
  workTypeOptions,
  type JobFacets,
} from "@/lib/jobs/filters";
import { ALL, type Job } from "@/lib/jobs/types";
import type { JobFilterData } from "@/lib/api/jobs";
import { cn } from "@/lib/utils";
import { SectionRule } from "@/components/brand/section-rule";

/**
 * Two filter layers, matching what the API actually supports.
 *
 * Position name, location and salary band go back to
 * `getRecruitmentOrderList` through the URL, so results stay linkable and
 * server-rendered. Position group, company and work type are refined over the
 * rows already on the page.
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

  const locationId = params.get("locationid") ?? "";
  const salaryLevelId = params.get("salaryLevelID") ?? "";

  const visibleJobs = React.useMemo(() => applyFacets(jobs, facets), [jobs, facets]);
  const groups = React.useMemo(() => groupOptions(jobs), [jobs]);
  const companies = React.useMemo(() => companyOptions(jobs), [jobs]);
  const workTypes = React.useMemo(() => workTypeOptions(jobs), [jobs]);
  const locations = React.useMemo(() => locationOptions(filterData), [filterData]);
  const salaryLevels = React.useMemo(() => salaryOptions(filterData), [filterData]);

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

  const hasFacets = isFiltered(facets);

  const filterSections = (
    <>
      <FilterSection
        title="Албан тушаалын бүлэг"
        options={groups}
        value={facets.group}
        onChange={(value) => setFacets((current) => ({ ...current, group: value }))}
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
        onChange={(value) => setFacets((current) => ({ ...current, company: value }))}
      />
      <FilterSection
        title="Ажлын төрөл"
        options={workTypes}
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
          {hasFacets || locationId || salaryLevelId ? (
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
            {filterSections}
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
            <ul key={`${facets.group}-${facets.company}-${facets.workType}`}>
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
                        job.remainingDays != null ? (
                          <>
                            <span className="text-foreground font-medium">
                              {job.remainingDays}
                            </span>{" "}
                            хоног<span className="hidden sm:inline"> үлдсэн</span>
                          </>
                        ) : null
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
