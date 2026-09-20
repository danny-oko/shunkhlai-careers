import type { JobDetail as JobDetailDto, JobListRow, JobOrder } from "@/lib/api/jobs";

import type { Job, JobDetail } from "./types";

/** The only place that knows the recruitment API's field names for postings. */

export function toSlug(id: string | number, title: string): string {
  const readable = title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return readable ? `${id}-${readable}` : String(id);
}

/** Reads the posting id back out of a slug, or accepts a bare id. */
export function parseJobId(slugOrId: string): string | null {
  const match = /^(\d+)(?:-|$)/.exec(slugOrId);
  return match ? match[1] : null;
}

const DAY_MS = 86_400_000;

/** Midnight (local) of the given moment's calendar day. */
function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Whole days from `now`'s calendar day to `end`; negative once it has passed. */
function dayDiff(end: Date, now: Date | undefined): number {
  return Math.round((end.getTime() - startOfDay(now ?? new Date()).getTime()) / DAY_MS);
}

/**
 * Whole days from today to the advert's closing day (`YYYY.MM.DD`); negative
 * once it has passed, 0 on the closing day. `null` when there is no parseable
 * closing date.
 *
 * Computed from `advenddate` rather than read from the list's `remainingdays`,
 * which the live list sends with the wrong sign for expired adverts (posting
 * 923: closed 2026.05.29, list said +114, get-one said -114). The server does
 * not enforce expiry either, so this is the only place it is decided.
 */
export function daysUntilClose(advenddate: string | null | undefined, now?: Date): number | null {
  const end = parseApiDate(advenddate ?? "");
  return end ? dayDiff(end, now) : null;
}

/** A finite number of days, else `null` (absent, `NaN`, a string...). */
function finiteDays(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/**
 * Open while the closing day has not passed; the date always wins. Without a
 * usable date the backend's own count is trusted only when it says "already
 * closed" (negative): the live get-one endpoint drops `advenddate` for an
 * expired posting but still sends `remainingdays` -114, whereas the list's
 * positive count next to a past date is the wrong-signed one. No date and no
 * negative count = open-ended.
 */
export function isPostingOpen(
  advenddate: string | null | undefined,
  fallbackRemainingDays: number | null | undefined,
  now?: Date,
): boolean {
  return (daysUntilClose(advenddate, now) ?? finiteDays(fallbackRemainingDays) ?? 0) >= 0;
}

function base(row: JobListRow | JobOrder): Job {
  const id = String(row.entryid);
  const title = (row.posname ?? "").trim();

  return {
    id,
    slug: toSlug(id, title),
    title,
    company: (row.companyname ?? "").trim(),
    companyId: row.companyid ?? "",
    location: (row.locname ?? "").trim(),
    positionGroup: (row.posgroupname ?? "").trim(),
    positionGroupId: row.posgroupid ?? 0,
    workType: (row.worktype ?? "").trim(),
    positionType: (row.postype ?? "").trim(),
    statusId: row.status ?? 0,
    status: (row.statusname ?? "").trim(),
    // `||`, not `??`: the backend sends "" for a date it does not have, and
    // an empty advert start date must still fall through to the request date
    // or the row sorts to the bottom of the list forever.
    postedAt: row.advbegindate || row.requestdate || "",
    closesAt: row.advenddate ?? "",
    // `null` means the posting has no closing date, not that it closes
    // today — leave it unset instead of collapsing to 0.
    remainingDays: daysUntilClose(row.advenddate) ?? row.remainingdays ?? null,
    isOpen: isPostingOpen(row.advenddate, row.remainingdays),
  };
}

export function toJob(row: JobListRow): Job | null {
  if (!row?.entryid || !row.posname) return null;
  return base(row);
}

export function toJobs(rows: JobListRow[]): Job[] {
  return rows.map(toJob).filter((job): job is Job => job !== null);
}

/**
 * The detail endpoint returns the posting plus its requirements and duties as
 * separate arrays of `{ name }`. `orderreq` / `orderres` carry the same text as
 * JSON strings; the arrays are the parsed form, so they are what we read.
 *
 * Unlike the list endpoint, the live backend's single-order response omits
 * `entryid` on the order row. `requestedId` is the id we already fetched
 * with (from the slug or bare id the caller passed to `getJob`), used as a
 * fallback so a posting whose own row lacks `entryid` doesn't 404.
 */
export function toJobDetail(
  dto: JobDetailDto,
  requestedId?: string | number,
): JobDetail | null {
  const row = dto?.hrrecruitmentorder?.[0];
  if (!row?.posname) return null;

  const order = { ...row, entryid: row.entryid ?? Number(requestedId) };
  if (!order.entryid) return null;

  const names = (rows: Array<{ name: string }> | undefined) =>
    (rows ?? [])
      .map((row) => (row?.name ?? "").trim())
      .filter((line) => line.length > 0);

  return {
    ...base(order),
    salaryLevel: order.salarylevel?.trim() || null,
    level: order.levelname?.trim() || null,
    quantity: typeof order.quantity === "number" ? order.quantity : null,
    mapUrl: order.mapurl || null,
    responsibilities: names(dto.mainresp),
    requirements: names(dto.mainreq),
    additional: order.addreq?.trim() || null,
  };
}

/** `2026.07.24` → a Date, for sorting. Returns null for anything unparseable. */
export function parseApiDate(value: string): Date | null {
  const match = /^(\d{4})[.\-/](\d{2})[.\-/](\d{2})$/.exec(value?.trim() ?? "");
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}
