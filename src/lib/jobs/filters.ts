import { stripCode } from "@/lib/api/core/factories";
import type { JobFilterData } from "@/lib/api/jobs";

import { salaryBands } from "./apply";
import { ALL, type FacetOption, type Job } from "./types";

/**
 * Two layers of filtering.
 *
 * The API filters server-side on position name, location and salary band
 * (`getRecruitmentOrderList`). Everything else the list rows carry —
 * position group, company, position type, work type — is refined here, over
 * the rows already fetched, so those clicks cost nothing.
 *
 * The refined lists are built from `getDropDownData`, not tallied from the
 * rows, so their labels and their order are the ERP's.
 *
 * Компани is the exception the owner asked for: all eight companies are listed
 * whatever is open, because "nothing open there right now" is itself the
 * answer. Every other list drops its empty rows — the ERP knows 21 position
 * groups and the postings sit in one or two of them, which would otherwise be
 * a rail of dead rows. A row that is currently selected always survives, so a
 * selection that falls to zero can still be cleared.
 */

export type JobFacets = {
  group: string;
  company: string;
  positionType: string;
  workType: string;
};

export const defaultFacets: JobFacets = {
  group: ALL,
  company: ALL,
  positionType: ALL,
  workType: ALL,
};

export type CompanyRow = { companyid: string; name: string };

/**
 * The group's companies, in the order `getDropDownData.smcompany` lists them
 * (verified live 2026-09-23). Only a fallback: the live list wins whenever the
 * call succeeds. It is here so the Компани filter still lists every company
 * when the dropdown call fails — the owner asked for all eight, always.
 */
export const FALLBACK_COMPANIES: CompanyRow[] = [
  { companyid: "SHUNKHLAI", name: "Шунхлай ХХК" },
  { companyid: "SHTRADING", name: "Шунхлай трейдинг ХХК" },
  { companyid: "SHPETRO", name: "Шунхлай петролиум ХХК" },
  { companyid: "SHGOBI", name: "Шунхлай говь ХХК" },
  { companyid: "SHOIL", name: "Шунхлай ойл ХХК" },
  { companyid: "SGSHDEPO", name: "ЭсЖиШивээхүрэн депо ХХК" },
  { companyid: "SGKHANGI", name: "ЭсЖиХанги Гэйт ХХК" },
  { companyid: "SGHOLDING", name: "SGHOLDING" },
];

/** Only open postings are listed, so only they are counted. */
function openJobs(jobs: Job[]): Job[] {
  return jobs.filter((job) => job.isOpen);
}

function tally(jobs: Job[], pick: (job: Job) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const job of jobs) {
    const value = pick(job);
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

/**
 * A reference list as filter options, in the order the ERP sent the rows,
 * each with the number of open postings behind it.
 *
 * `keepEmpty` decides what happens to a row with none: Компани keeps them,
 * every other list drops them — except the one currently selected, which stays
 * so it can still be cleared.
 */
function referenceOptions<T>(
  rows: T[],
  jobs: Job[],
  allLabel: string,
  read: (row: T) => { value: string; label: string },
  pick: (job: Job) => string,
  { keepEmpty = false, selected = ALL }: { keepEmpty?: boolean; selected?: string } = {},
): FacetOption[] {
  const open = openJobs(jobs);
  const counts = tally(open, pick);
  return [
    { value: ALL, label: allLabel, count: open.length },
    ...rows
      .map((row) => {
        const { value, label } = read(row);
        return { value, label, count: counts.get(value) ?? 0 };
      })
      .filter((option) => keepEmpty || option.count > 0 || option.value === selected),
  ];
}

/** The live company list when there is one, the built-in copy otherwise. */
export function companyRows(filterData: JobFilterData | null): CompanyRow[] {
  const rows = (filterData?.smcompany ?? []).filter(
    (row) => row?.companyid && row?.name,
  );
  return rows.length > 0 ? rows : FALLBACK_COMPANIES;
}

/**
 * Which company a posting belongs to, as a `companyid`.
 *
 * The list rows carry `companyid` ("SHUNKHLAI"), which is what the facet is
 * keyed on. A row that somehow arrives without one is matched back through
 * its `companyname`, so it still lands in the right bucket.
 */
export function companyKey(job: Job, rows: CompanyRow[]): string {
  const id = (job.companyId ?? "").trim();
  if (id) return id;
  const name = (job.company ?? "").trim();
  if (!name) return "";
  return rows.find((row) => row.name.trim() === name)?.companyid ?? "";
}

/** All eight companies, always — the one list that keeps its empty rows. */
export function companyOptions(
  filterData: JobFilterData | null,
  jobs: Job[],
): FacetOption[] {
  const rows = companyRows(filterData);
  return referenceOptions(
    rows,
    jobs,
    "Бүх компани",
    (row) => ({ value: row.companyid, label: row.name.trim() }),
    (job) => companyKey(job, rows),
    { keepEmpty: true },
  );
}

/**
 * From `getDropDownData.hrposgroup`, not `getPosGroupDropdown`: the same
 * groups under the same `posgroupid`s, but without the `/04/` code prefix the
 * dropdown endpoint puts in front of every name. `stripCode` is kept as a belt
 * in case the bundle ever starts carrying them too.
 */
export function groupOptions(
  filterData: JobFilterData | null,
  jobs: Job[],
  selected = ALL,
): FacetOption[] {
  return referenceOptions(
    filterData?.hrposgroup ?? [],
    jobs,
    "Бүх бүлэг",
    (row) => ({ value: String(row.posgroupid), label: stripCode(row.name) }),
    (job) => String(job.positionGroupId || ""),
    { selected },
  );
}

/** `positiontype.valuestr` is the rows' `postypeid` — "Үндсэн", "Гэрээт", … */
export function positionTypeOptions(
  filterData: JobFilterData | null,
  jobs: Job[],
  selected = ALL,
): FacetOption[] {
  return referenceOptions(
    filterData?.positiontype ?? [],
    jobs,
    "Бүх хэлбэр",
    (row) => ({ value: String(row.valuestr), label: stripCode(row.name) }),
    (job) => String(job.positionTypeId || ""),
    { selected },
  );
}

/**
 * Work type has no reference list of its own in `getDropDownData`, so it stays
 * tallied from the rows: busiest first, then by code unit.
 *
 * Deliberately not `localeCompare`: these lists mix Cyrillic and Latin names,
 * and Node's collation orders that mix differently from the browser's — which
 * shows up as a hydration mismatch, since the server and the client would
 * render the same list in two different orders.
 */
export function workTypeOptions(jobs: Job[]): FacetOption[] {
  const open = openJobs(jobs);
  const counts = tally(open, (job) => job.workType);
  const order = [...counts.keys()].sort((a, b) => {
    const byCount = counts.get(b)! - counts.get(a)!;
    if (byCount !== 0) return byCount;
    return a < b ? -1 : a > b ? 1 : 0;
  });

  return [
    { value: ALL, label: "Бүх төрөл", count: open.length },
    ...order.map((value) => ({ value, label: value, count: counts.get(value)! })),
  ];
}

/**
 * The two lists the API filters on, in the same shape as the rest so they
 * render as the same rows. The values are the ids the query string carries,
 * with `ALL` standing in for "no filter" — no counts, because the page only
 * ever holds the rows for the current selection.
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
    ...salaryBands(filterData).map((level) => ({
      value: String(level.key),
      label: `${level.text}₮`,
    })),
  ];
}

export function matchesFacets(
  job: Job,
  facets: JobFacets,
  companies: CompanyRow[] = FALLBACK_COMPANIES,
): boolean {
  // Expired adverts are never listed. There is nothing a candidate can do
  // with a posting they cannot apply to, so this is not a facet to toggle.
  // The detail page still renders the expired state, for anyone arriving on
  // an old link.
  if (!job.isOpen) return false;
  if (facets.group !== ALL && String(job.positionGroupId) !== facets.group) return false;
  if (facets.company !== ALL && companyKey(job, companies) !== facets.company) return false;
  if (facets.positionType !== ALL && String(job.positionTypeId) !== facets.positionType) {
    return false;
  }
  if (facets.workType !== ALL && job.workType !== facets.workType) return false;
  return true;
}

export function applyFacets(
  jobs: Job[],
  facets: JobFacets,
  companies: CompanyRow[] = FALLBACK_COMPANIES,
): Job[] {
  return jobs.filter((job) => matchesFacets(job, facets, companies));
}

export function isFiltered(facets: JobFacets): boolean {
  return (
    facets.group !== ALL ||
    facets.company !== ALL ||
    facets.positionType !== ALL ||
    facets.workType !== ALL
  );
}
