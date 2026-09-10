"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUpRight, SlidersHorizontal, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { FilterSection } from "@/components/job-filters";
import {
  getDepartmentOptions,
  getLocationOptions,
  matchesDepartment,
  matchesLocation,
} from "@/lib/jobs/filters";
import { ALL_DEPARTMENTS, ALL_LOCATIONS, type Job } from "@/lib/jobs/types";

export function JobBrowser({ jobs }: { jobs: Job[] }) {
  const [location, setLocation] = React.useState(ALL_LOCATIONS);
  const [department, setDepartment] = React.useState(ALL_DEPARTMENTS);
  const [isPanelOpen, setIsPanelOpen] = React.useState(false);

  const locationOptions = React.useMemo(() => getLocationOptions(jobs), [jobs]);
  const departmentOptions = React.useMemo(
    () => getDepartmentOptions(jobs),
    [jobs],
  );

  const visibleJobs = React.useMemo(
    () =>
      jobs.filter(
        (job) => matchesLocation(job, location) && matchesDepartment(job, department),
      ),
    [jobs, location, department],
  );

  const isFiltered =
    location !== ALL_LOCATIONS || department !== ALL_DEPARTMENTS;

  function clearFilters() {
    setLocation(ALL_LOCATIONS);
    setDepartment(ALL_DEPARTMENTS);
  }

  const filterSections = (
    <>
      <FilterSection
        title="Location"
        options={locationOptions}
        value={location}
        onChange={setLocation}
      />
      <FilterSection
        title="Department"
        options={departmentOptions}
        value={department}
        onChange={setDepartment}
      />
    </>
  );

  return (
    <div className="border-t border-border/70">
      {/* Mobile: the filter tree collapses behind a single toggle. */}
      <div className="border-b border-border/70 px-6 py-4 lg:hidden">
        <button
          type="button"
          onClick={() => setIsPanelOpen((open) => !open)}
          aria-expanded={isPanelOpen}
          className="inline-flex items-center gap-2 rounded-full border border-border/70 px-4 py-2 text-sm font-medium transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <SlidersHorizontal className="size-3.5" />
          Filters
          {isFiltered ? (
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
            <div className="px-6 py-5">
              <button
                type="button"
                onClick={clearFilters}
                disabled={!isFiltered}
                className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
              >
                <X className="size-3.5" />
                Clear filters
              </button>
            </div>
          </div>
        </aside>

        <div>
          {visibleJobs.length === 0 ? (
            <div className="px-6 py-24 text-center sm:px-10">
              <p className="text-base font-medium">No roles match those filters</p>
              <p className="mt-2 text-sm text-muted-foreground">
                Try widening your search, or clear the filters to see all{" "}
                {jobs.length} open roles.
              </p>
              <button
                type="button"
                onClick={clearFilters}
                className="mt-6 rounded-full border border-border/70 px-4 py-2 text-sm font-medium transition-colors hover:bg-muted"
              >
                Clear filters
              </button>
            </div>
          ) : (
            /* Keyed on the active filters so the entrance replays whenever
               the result set changes. */
            <ul key={`${location}-${department}`}>
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
                    {/* Inset panel so the whole card lights up on hover without
                        painting an edge-to-edge band across the list. */}
                    <span
                      aria-hidden
                      className="pointer-events-none absolute inset-x-2 inset-y-2 -z-10 rounded-xl bg-muted/60 opacity-0 transition-opacity duration-200 group-hover:opacity-100 sm:inset-x-4 sm:inset-y-3"
                    />

                    <div className="min-w-0">
                      <h2 className="flex items-center gap-1.5 text-lg font-medium tracking-[-0.02em] sm:text-xl">
                        {job.title}, {job.department}
                        <ArrowUpRight className="size-4 shrink-0 text-muted-foreground opacity-0 transition-all duration-200 group-hover:translate-x-0.5 group-hover:opacity-100" />
                      </h2>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {job.location} · {job.type}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full border border-border/70 px-4 py-2 text-sm font-medium transition-colors group-hover:border-transparent group-hover:bg-foreground group-hover:text-background">
                      Read more
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
