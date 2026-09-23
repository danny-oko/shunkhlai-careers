import { ALL, type FacetOption } from "@/lib/jobs/types";
import type { JobFacets } from "@/lib/jobs/filters";

export type FilterKey =
  | "search"
  | "group"
  | "location"
  | "salary"
  | "company"
  | "positionType"
  | "workType";

export type ActiveFilter = {
  key: FilterKey;
  /** Section title, used as the fallback label. */
  title: string;
  label: string;
};

export const FILTER_TITLES: Record<FilterKey, string> = {
  search: "Хайлт",
  group: "Албан тушаалын бүлэг",
  location: "Байршил",
  salary: "Цалингийн түвшин",
  company: "Компани",
  positionType: "Ажиллах хэлбэр",
  workType: "Ажлын төрөл",
};

/** Label of the selected option, or null when nothing (or "all") is selected. */
export function selectedLabel(
  options: FacetOption[],
  value: string,
): string | null {
  if (!value || value === ALL) return null;
  return options.find((option) => option.value === value)?.label ?? null;
}

export type ActiveFilterInput = {
  facets: JobFacets;
  /** The `jobName` search the URL carries. */
  jobName: string;
  locationId: string;
  salaryLevelId: string;
  groups: FacetOption[];
  companies: FacetOption[];
  positionTypes: FacetOption[];
  workTypes: FacetOption[];
  locations: FacetOption[];
  salaryLevels: FacetOption[];
};

/**
 * One entry per active filter, in the order the sections are shown. A value
 * that is active but missing from its option list (a stale URL param) still
 * counts, and falls back to the section title so it can be removed.
 */
export function buildActiveFilters(input: ActiveFilterInput): ActiveFilter[] {
  const entries: [FilterKey, string, FacetOption[]][] = [
    ["group", input.facets.group, input.groups],
    ["location", input.locationId, input.locations],
    ["salary", input.salaryLevelId, input.salaryLevels],
    ["company", input.facets.company, input.companies],
    ["positionType", input.facets.positionType, input.positionTypes],
    ["workType", input.facets.workType, input.workTypes],
  ];
  const active: ActiveFilter[] = [];

  // The search text is its own chip, first, quoted so it reads as what was
  // typed rather than as the name of an option.
  const search = (input.jobName ?? "").trim();
  if (search) {
    active.push({
      key: "search",
      title: FILTER_TITLES.search,
      label: `«${search}»`,
    });
  }

  for (const [key, value, options] of entries) {
    if (!value || value === ALL) continue;
    active.push({
      key,
      title: FILTER_TITLES[key],
      label: selectedLabel(options, value) ?? FILTER_TITLES[key],
    });
  }
  return active;
}

export function countActiveFilters(input: ActiveFilterInput): number {
  return buildActiveFilters(input).length;
}
