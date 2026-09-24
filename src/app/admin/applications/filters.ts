import type { DeskApplication } from "@/server/applicant/application-desk";
import { DESK_STATUSES, type DeskStatus, deskStatus, rowJob } from "./labels";

/**
 * The two filters, as pure functions over rows.
 *
 * Pure on purpose: the page is a server component that re-renders from the
 * query string, so there is nothing to test through a browser, and the part
 * worth testing — which rows a filter keeps and what the pills count — is
 * arithmetic. Nothing here reads the database, the ERP or `searchParams`
 * directly; the page hands it what it already has.
 */

export type StatusFilter = DeskStatus | "all";

/** `all`, or a posting: its `entryid` as text, or the title when it has none. */
export type JobFilter = string;

export const ALL = "all" as const;

export type ApplicationFilter = { status: StatusFilter; job: JobFilter };

export const EMPTY_FILTER: ApplicationFilter = { status: ALL, job: ALL };

const STATUS_VALUES: readonly string[] = [ALL, ...DESK_STATUSES];

/**
 * The value that identifies a posting in the filter.
 *
 * The id, when the row carries one — two postings can share a title, and an
 * id survives a posting being renamed in the ERP. A row pulled from the ERP
 * has no `recruitmentorderid` (its list does not send one), so those fall back
 * to the title, which is all that distinguishes them.
 */
export const jobValue = (row: Pick<DeskApplication, "jobId" | "jobTitle">): string =>
  row.jobId > 0 ? String(row.jobId) : row.jobTitle || ALL;

/** First value wins; anything unrecognised is `all` rather than an error. */
function one(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

/**
 * The filter a request asks for.
 *
 * Unknown values fall back to `all` instead of showing nothing: a hand-typed
 * or stale query string should land on the whole list, not on an empty screen
 * that reads as "there are no applications".
 */
export function parseFilter(
  params: Record<string, string | string[] | undefined>,
): ApplicationFilter {
  const status = one(params.status);
  const job = one(params.job);
  return {
    status: STATUS_VALUES.includes(status) ? (status as StatusFilter) : ALL,
    job: job || ALL,
  };
}

export const isFiltered = (filter: ApplicationFilter): boolean =>
  filter.status !== ALL || filter.job !== ALL;

export function matches(row: DeskApplication, filter: ApplicationFilter): boolean {
  if (filter.status !== ALL && deskStatus(row.push) !== filter.status) return false;
  if (filter.job !== ALL && jobValue(row) !== filter.job) return false;
  return true;
}

export const applyFilter = (
  rows: readonly DeskApplication[],
  filter: ApplicationFilter,
): DeskApplication[] => rows.filter((row) => matches(row, filter));

/* --- what the pills say -------------------------------------------------- */

export type Option = { value: string; label: string; count: number };

/**
 * One pill per status, counted against the *other* filter.
 *
 * Counting against the whole list instead would print numbers that do not add
 * up to what pressing the pill shows, which is the quiet way a filter row
 * stops being trusted.
 */
export function statusOptions(
  rows: readonly DeskApplication[],
  filter: ApplicationFilter,
  label: (status: DeskStatus) => string,
): Option[] {
  const inJob = rows.filter((row) => filter.job === ALL || jobValue(row) === filter.job);
  const counted = new Map<DeskStatus, number>();
  for (const row of inJob) {
    const status = deskStatus(row.push);
    counted.set(status, (counted.get(status) ?? 0) + 1);
  }
  return [
    { value: ALL, label: "Бүгд", count: inJob.length },
    // Only the states that actually occur: a desk where nothing has failed
    // should not carry an "Анхаарал 0" pill inviting a press that shows
    // nothing. The active one stays even at zero, so the reader can see what
    // they filtered by.
    ...DESK_STATUSES.filter(
      (status) => (counted.get(status) ?? 0) > 0 || filter.status === status,
    ).map((status) => ({
      value: status,
      label: label(status),
      count: counted.get(status) ?? 0,
    })),
  ];
}

/** One pill per posting applied to, counted against the status filter. */
export function jobOptions(
  rows: readonly DeskApplication[],
  filter: ApplicationFilter,
): Option[] {
  const inStatus = rows.filter(
    (row) => filter.status === ALL || deskStatus(row.push) === filter.status,
  );
  const counted = new Map<string, Option>();
  for (const row of inStatus) {
    const value = jobValue(row);
    const existing = counted.get(value);
    if (existing) existing.count += 1;
    else counted.set(value, { value, label: rowJob(row), count: 1 });
  }
  if (filter.job !== ALL && !counted.has(filter.job)) {
    counted.set(filter.job, { value: filter.job, label: filter.job, count: 0 });
  }
  return [
    { value: ALL, label: "Бүх ажлын байр", count: inStatus.length },
    // Busiest posting first: the one an admin is most likely to want is the
    // one most people applied to, and alphabetical order in Mongolian buries
    // it behind whatever starts with А.
    ...[...counted.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
  ];
}

/** `/admin/applications?…` with one facet changed and the other kept. */
export function filterHref(filter: ApplicationFilter, patch: Partial<ApplicationFilter>): string {
  const next = { ...filter, ...patch };
  const query = new URLSearchParams();
  if (next.status !== ALL) query.set("status", next.status);
  if (next.job !== ALL) query.set("job", next.job);
  const search = query.toString();
  return search ? `/admin/applications?${search}` : "/admin/applications";
}
