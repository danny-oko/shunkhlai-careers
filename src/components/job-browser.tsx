"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { FilterSection } from "@/components/job-filters";
import { FuelLine } from "@/components/brand/fuel-line";
import {
  applyFacets,
  companyOptions,
  defaultFacets,
  groupOptions,
  isFiltered,
  workTypeOptions,
  type JobFacets,
} from "@/lib/jobs/filters";
import type { Job } from "@/lib/jobs/types";
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
  const [search, setSearch] = React.useState(params.get("jobName") ?? "");

  const locationId = params.get("locationid") ?? "";
  const salaryLevelId = params.get("salaryLevelID") ?? "";

  const visibleJobs = React.useMemo(() => applyFacets(jobs, facets), [jobs, facets]);
  const groups = React.useMemo(() => groupOptions(jobs), [jobs]);
  const companies = React.useMemo(() => companyOptions(jobs), [jobs]);
  const workTypes = React.useMemo(() => workTypeOptions(jobs), [jobs]);

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
    setSearch("");
    router.push("/careers");
  }

  const hasFacets = isFiltered(facets);
  const hasQuery = Boolean(params.get("jobName") || locationId || salaryLevelId);

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
      <form
        className="grid gap-3 border-b border-border/70 px-6 py-5 sm:grid-cols-[minmax(0,1fr)_auto] lg:px-10"
        onSubmit={(event) => {
          event.preventDefault();
          pushQuery({ jobName: search.trim() });
        }}
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="relative sm:col-span-1">
            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Албан тушаалаар хайх"
              aria-label="Албан тушаалаар хайх"
              className="pl-9"
            />
          </div>

          <Select
            aria-label="Байршил"
            value={locationId}
            onChange={(event) => pushQuery({ locationid: event.target.value })}
          >
            <option value="">Бүх байршил</option>
            {(filterData?.location ?? []).map((location) => (
              <option key={location.entryid} value={location.entryid}>
                {location.name} — {location.divisionname}
              </option>
            ))}
          </Select>

          <Select
            aria-label="Цалингийн түвшин"
            value={salaryLevelId}
            onChange={(event) => pushQuery({ salaryLevelID: event.target.value })}
          >
            <option value="">Бүх цалингийн түвшин</option>
            {(filterData?.salarylevel ?? []).map((level) => (
              <option key={level.key} value={level.key}>
                {level.text}₮
              </option>
            ))}
          </Select>
        </div>

        <div className="flex gap-2">
          <Button type="submit" className="h-9 rounded-full px-5">
            Хайх
          </Button>
          {hasQuery || hasFacets ? (
            <Button
              type="button"
              variant="ghost"
              onClick={clearEverything}
              className="h-9 rounded-full px-4"
            >
              <X className="size-3.5" />
              Цэвэрлэх
            </Button>
          ) : null}
        </div>
      </form>

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
          {hasFacets ? <span className="size-1.5 rounded-full bg-primary" /> : null}
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
            <label className="flex cursor-pointer items-center gap-3 px-6 py-5 text-sm">
              <input
                type="checkbox"
                checked={facets.openOnly}
                onChange={(event) =>
                  setFacets((current) => ({ ...current, openOnly: event.target.checked }))
                }
                className="accent-[var(--brand)] size-4"
              />
              Зөвхөн нээлттэй зар
            </label>
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
            <ul>
              {visibleJobs.map((job) => (
                <li key={job.id} className="border-b border-border/70">
                  <Link
                    href={`/careers/${job.slug}`}
                    className="group relative isolate block px-6 pt-8 pb-6 focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none focus-visible:-outline-offset-2 sm:px-10 sm:pt-10 sm:pb-7"
                  >
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-2 inset-y-2 -z-10 rounded-xl bg-muted/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100 sm:inset-x-4 sm:inset-y-3"
                    />

                    <div className="flex items-baseline justify-between gap-6">
                      <h2 className="min-w-0 text-lg font-medium tracking-[-0.02em] sm:text-xl">
                        {job.title}
                      </h2>
                      {/* The one fact a candidate decides on. */}
                      <p
                        className={cn(
                          "shrink-0 text-sm tabular-nums",
                          !job.isOpen && "text-brand-navy",
                          job.isOpen && job.remainingDays <= 3 && "font-medium text-brand",
                          job.isOpen && job.remainingDays > 3 && "text-muted-foreground",
                        )}
                      >
                        {job.isOpen
                          ? `${job.remainingDays} хоног үлдсэн`
                          : "Хугацаа дууссан"}
                      </p>
                    </div>

                    <p className="mt-2.5 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted-foreground">
                      {[job.company, job.location, job.workType, job.positionGroup]
                        .filter(Boolean)
                        .map((detail) => (
                          <span key={detail}>{detail}</span>
                        ))}
                    </p>

                    <FuelLine remainingDays={job.remainingDays} className="mt-6" />
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
