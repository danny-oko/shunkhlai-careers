/**
 * The job shape the UI renders.
 *
 * Deliberately not the backend's shape: the recruitment API speaks in
 * `entryid` / `jobname` / `brieftext` and returns its long text as blobs.
 * Everything is translated once, in `mapper.ts`, so a rename on the backend
 * never reaches a component.
 */

export type JobType = "Full-time" | "Part-time" | "Contract" | "Internship";

export type Job = {
  /** The backend's `entryID`, as a string. */
  id: string;
  /** URL segment: the id followed by a readable title, e.g. `4-station-manager`. */
  slug: string;
  title: string;
  department: string;
  /** Display string, e.g. "Ulaanbaatar, Mongolia". */
  location: string;
  /** Structured location used by the filter tree. "Remote" is its own country. */
  country: string;
  city?: string;
  type: JobType;
  /** Short one-line hook shown under the title in the header. */
  summary: string;
  /** Salary band, already formatted for display. Omitted when undisclosed. */
  salary?: string;
  experience: string;
  postedAt: string;
  aboutRole: string;
  responsibilities: string[];
  requirements: string[];
  benefits: string[];
};

/**
 * A single row in a filter list. `depth: 1` rows are children of the country
 * above them and render indented behind an em dash.
 */
export type FilterOption = {
  value: string;
  label: string;
  depth: 0 | 1;
  count: number;
};

export const ALL_LOCATIONS = "all-locations";
export const ALL_DEPARTMENTS = "all-departments";
