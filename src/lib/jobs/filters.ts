import { ALL, type FacetOption, type Job } from "./types";

/**
 * Two layers of filtering.
 *
 * The API filters server-side on position name, location and salary band
 * (`getRecruitmentOrderList`). Everything else the list rows carry —
 * position group, company, work type — is refined here, over the rows already
 * fetched, so those clicks cost nothing.
 */

export type JobFacets = {
  group: string;
  company: string;
  workType: string;
  openOnly: boolean;
};

export const defaultFacets: JobFacets = {
  group: ALL,
  company: ALL,
  workType: ALL,
  openOnly: true,
};

function tally(jobs: Job[], pick: (job: Job) => string, allLabel: string): FacetOption[] {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    const value = pick(job);
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  /**
   * Busiest group first, then by code unit.
   *
   * Deliberately not `localeCompare`: these lists mix Cyrillic and Latin
   * names, and Node's collation orders that mix differently from the
   * browser's — which shows up as a hydration mismatch, since the server and
   * the client would render the same list in two different orders.
   */
  const order = [...counts.keys()].sort((a, b) => {
    const byCount = counts.get(b)! - counts.get(a)!;
    if (byCount !== 0) return byCount;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  return [
    { value: ALL, label: allLabel, count: jobs.length },
    ...order.map((value) => ({ value, label: value, count: counts.get(value)! })),
  ];
}

export function groupOptions(jobs: Job[]) {
  return tally(jobs, (job) => job.positionGroup, "Бүх бүлэг");
}

export function companyOptions(jobs: Job[]) {
  return tally(jobs, (job) => job.company, "Бүх компани");
}

export function workTypeOptions(jobs: Job[]) {
  return tally(jobs, (job) => job.workType, "Бүх төрөл");
}

export function matchesFacets(job: Job, facets: JobFacets): boolean {
  if (facets.openOnly && !job.isOpen) return false;
  if (facets.group !== ALL && job.positionGroup !== facets.group) return false;
  if (facets.company !== ALL && job.company !== facets.company) return false;
  if (facets.workType !== ALL && job.workType !== facets.workType) return false;
  return true;
}

export function applyFacets(jobs: Job[], facets: JobFacets): Job[] {
  return jobs.filter((job) => matchesFacets(job, facets));
}

export function isFiltered(facets: JobFacets): boolean {
  return (
    facets.group !== ALL ||
    facets.company !== ALL ||
    facets.workType !== ALL ||
    facets.openOnly !== defaultFacets.openOnly
  );
}
