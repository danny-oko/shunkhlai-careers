import type { JobFilterData } from "@/lib/api/jobs";

import { ALL, type FacetOption, type Job } from "./types";

/**
 * Two layers of filtering.
 *
 * The API filters server-side on position name, location and salary band
 * (`getRecruitmentOrderList`). Everything else — position group, company,
 * position type, work type — is refined here, over the rows already fetched,
 * so those clicks cost nothing.
 *
 * Where the option lists come from is a separate question, and the answer is
 * one call: `getDropDownData` returns every list the job search is meant to
 * offer. Tallying the loaded rows instead would only ever show the values
 * that survived the current filter, so a candidate could never see the
 * companies or the salary bands they are not already looking at. Work type is
 * the one exception — the bundle carries no list for it — so it is still read
 * off the rows.
 */

export type JobFacets = {
  /** `hrposgroup.posgroupid`, as a string. */
  group: string;
  /** `smcompany.companyid`. */
  company: string;
  /** `positiontype.valuestr`, as a string. */
  positionType: string;
  /** The work type's own name: the bundle has no list to take ids from. */
  workType: string;
};

export const defaultFacets: JobFacets = {
  group: ALL,
  company: ALL,
  positionType: ALL,
  workType: ALL,
};

type BundleRow = { value: string; label: string };

/**
 * One bundle list in the shape the rail renders, each row carrying how many
 * of `jobs` it would leave.
 *
 * `jobs` is the result set with every *other* facet already applied, so a
 * count says what clicking that row would actually produce. The order is the
 * bundle's own — deliberately not re-sorted: these lists mix Cyrillic and
 * Latin names, and Node collates that mix differently from the browser, which
 * surfaces as a hydration mismatch.
 */
function options(
  bundle: BundleRow[],
  jobs: Job[],
  read: (job: Job) => BundleRow,
  allLabel: string,
): FacetOption[] {
  const counts = new Map<string, number>();
  const seen = new Map<string, string>();

  for (const job of jobs) {
    const { value, label } = read(job);
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
    if (label) seen.set(value, label);
  }

  const rows = bundle.filter((row) => row.value && row.label);
  // A posting can name a value the bundle does not list, and the bundle call
  // can fail outright — either way those rows are on the page and have to
  // stay reachable, so anything the postings carry is appended.
  const listed = new Set(rows.map((row) => row.value));
  for (const [value, label] of seen) {
    if (!listed.has(value)) rows.push({ value, label });
  }

  return [
    { value: ALL, label: allLabel, count: jobs.length },
    ...rows.map((row) => ({ ...row, count: counts.get(row.value) ?? 0 })),
  ];
}

export function groupOptions(filterData: JobFilterData | null, jobs: Job[]): FacetOption[] {
  return options(
    (filterData?.hrposgroup ?? []).map((row) => ({
      value: String(row.posgroupid),
      label: row.name,
    })),
    jobs,
    (job) => ({ value: job.positionGroupId ? String(job.positionGroupId) : "", label: job.positionGroup }),
    "Бүх бүлэг",
  );
}

export function companyOptions(filterData: JobFilterData | null, jobs: Job[]): FacetOption[] {
  return options(
    (filterData?.smcompany ?? []).map((row) => ({ value: row.companyid, label: row.name })),
    jobs,
    (job) => ({ value: job.companyId, label: job.company }),
    "Бүх компани",
  );
}

export function positionTypeOptions(
  filterData: JobFilterData | null,
  jobs: Job[],
): FacetOption[] {
  return options(
    (filterData?.positiontype ?? []).map((row) => ({
      value: String(row.valuestr),
      label: row.name,
    })),
    jobs,
    (job) => ({ value: job.positionTypeId ? String(job.positionTypeId) : "", label: job.positionType }),
    "Бүх хэлбэр",
  );
}

/**
 * No bundle list for this one, so the postings stand in for it.
 *
 * `jobs` is every posting on the page and is what the list is built from, so
 * the options stay put as the other facets move; `base` is what they are
 * counted against, exactly as for the bundle-backed lists.
 */
export function workTypeOptions(jobs: Job[], base: Job[]): FacetOption[] {
  const listed = new Set<string>();
  const bundle: BundleRow[] = [];
  for (const job of jobs) {
    if (!job.isOpen || !job.workType || listed.has(job.workType)) continue;
    listed.add(job.workType);
    bundle.push({ value: job.workType, label: job.workType });
  }

  return options(bundle, base, (job) => ({ value: job.workType, label: job.workType }), "Бүх төрөл");
}

/**
 * The two lists the API filters on, in the same shape as the rest so they
 * render as the same control. The values are the ids the query string
 * carries, with `ALL` standing in for "no filter" — no counts, because the
 * page only ever holds the rows for the current selection.
 */

export function locationOptions(filterData: JobFilterData | null): FacetOption[] {
  return [
    { value: ALL, label: "Бүх байршил" },
    ...(filterData?.location ?? []).map((location) => ({
      value: String(location.entryid),
      label: [location.name, location.divisionname].filter(Boolean).join(" — "),
    })),
  ];
}

export function salaryOptions(filterData: JobFilterData | null): FacetOption[] {
  return [
    { value: ALL, label: "Бүх цалингийн түвшин" },
    ...(filterData?.salarylevel ?? []).map((level) => ({
      value: String(level.key),
      label: `${level.text}₮`,
    })),
  ];
}

export function matchesFacets(job: Job, facets: JobFacets): boolean {
  // Expired adverts are never listed. There is nothing a candidate can do
  // with a posting they cannot apply to, so this is not a facet to toggle.
  // The detail page still renders the expired state, for anyone arriving on
  // an old link.
  if (!job.isOpen) return false;
  if (facets.group !== ALL && String(job.positionGroupId) !== facets.group) return false;
  if (facets.company !== ALL && job.companyId !== facets.company) return false;
  if (facets.positionType !== ALL && String(job.positionTypeId) !== facets.positionType) {
    return false;
  }
  if (facets.workType !== ALL && job.workType !== facets.workType) return false;
  return true;
}

export function applyFacets(jobs: Job[], facets: JobFacets): Job[] {
  return jobs.filter((job) => matchesFacets(job, facets));
}

/**
 * The rows one facet's counts are measured against: everything the other
 * facets keep, so a count reads as "what I get if I pick this".
 */
export function facetBase(jobs: Job[], facets: JobFacets, facet: keyof JobFacets): Job[] {
  return applyFacets(jobs, { ...facets, [facet]: ALL });
}

export function isFiltered(facets: JobFacets): boolean {
  return (
    facets.group !== ALL ||
    facets.company !== ALL ||
    facets.positionType !== ALL ||
    facets.workType !== ALL
  );
}
