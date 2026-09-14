/**
 * The job shape the UI renders.
 *
 * The backend speaks `posname` / `locname` / `advenddate`; components speak
 * this. `mapper.ts` is the only file that knows both.
 */

export type Job = {
  /** The posting's `entryid`. */
  id: string;
  /** URL segment: id plus a readable title, e.g. `786-bagazh-hariutsagch`. */
  slug: string;
  title: string;
  company: string;
  companyId: string;
  location: string;
  positionGroup: string;
  positionGroupId: number;
  /** "Бүтэн цагийн", "Цагийн", … */
  workType: string;
  /** "Үндсэн", "Гэрээт". */
  positionType: string;
  statusId: number;
  status: string;
  /** Advert window, as the backend formats it (`YYYY.MM.DD`). */
  postedAt: string;
  closesAt: string;
  /** Days left before the advert closes; negative once it has. */
  remainingDays: number;
  /** Still accepting applications. */
  isOpen: boolean;
};

export type JobDetail = Job & {
  salaryLevel: string | null;
  /** Required education level, e.g. "Мэргэжил хамаарахгүй". */
  level: string | null;
  /** How many people are being hired. */
  quantity: number | null;
  mapUrl: string | null;
  responsibilities: string[];
  requirements: string[];
  additional: string | null;
};

/** One row in a filter list. */
export type FacetOption = {
  value: string;
  label: string;
  /** Absent on the server-side lists: the page only holds the rows for the
      current selection, so there is no honest number to show. */
  count?: number;
};

export const ALL = "all";
