import { ALL_DEPARTMENTS, ALL_LOCATIONS, type FilterOption, type Job } from "./types";

/**
 * Filtering runs client-side over the already-fetched list. The backend also
 * accepts `jobName` / `locationid` / `salaryLevelID` on
 * `getRecruitmentOrderList`; move to those (and to `jobs.filterData()` for the
 * option lists) once the posting count outgrows a single fetch.
 */

/**
 * Builds the location tree: every country, each followed by its cities.
 * Countries without a city (Remote) contribute a single row.
 */
export function getLocationOptions(source: Job[]): FilterOption[] {
  const countries = new Map<string, Map<string, number>>();

  for (const job of source) {
    const cities = countries.get(job.country) ?? new Map<string, number>();
    if (job.city) {
      cities.set(job.city, (cities.get(job.city) ?? 0) + 1);
    }
    countries.set(job.country, cities);
  }

  const options: FilterOption[] = [
    { value: ALL_LOCATIONS, label: "All locations", depth: 0, count: source.length },
  ];

  for (const country of [...countries.keys()].sort((a, b) => a.localeCompare(b))) {
    const cities = countries.get(country)!;
    options.push({
      value: `country:${country}`,
      label: country,
      depth: 0,
      count: source.filter((job) => job.country === country).length,
    });

    for (const city of [...cities.keys()].sort((a, b) => a.localeCompare(b))) {
      options.push({
        value: `city:${city}`,
        label: city,
        depth: 1,
        count: cities.get(city)!,
      });
    }
  }

  return options;
}

export function getDepartmentOptions(source: Job[]): FilterOption[] {
  const departments = new Map<string, number>();
  for (const job of source) {
    departments.set(job.department, (departments.get(job.department) ?? 0) + 1);
  }

  return [
    { value: ALL_DEPARTMENTS, label: "All departments", depth: 0, count: source.length },
    ...[...departments.keys()]
      .sort((a, b) => a.localeCompare(b))
      .map<FilterOption>((department) => ({
        value: `department:${department}`,
        label: department,
        depth: 0,
        count: departments.get(department)!,
      })),
  ];
}

export function matchesLocation(job: Job, value: string): boolean {
  if (value === ALL_LOCATIONS) return true;
  if (value.startsWith("country:")) return job.country === value.slice(8);
  if (value.startsWith("city:")) return job.city === value.slice(5);
  return true;
}

export function matchesDepartment(job: Job, value: string): boolean {
  if (value === ALL_DEPARTMENTS) return true;
  if (value.startsWith("department:")) return job.department === value.slice(11);
  return true;
}
