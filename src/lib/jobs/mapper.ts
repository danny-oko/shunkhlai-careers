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
 * The one status that means "this advert is taking applications":
 * 5, "Анкет хүлээн авах".
 *
 * The dates cannot answer this. Live `getRecruitmentOrderList` (11 rows,
 * 2026-09-23) has seven rows with no `advenddate` at all — three of them
 * already in or past selection (status 7 "Сонгон шалгаруулалт явагдаж байна",
 * 11 "…дууссан") — and four rows whose `advenddate` is months in the past
 * while the status still says applications are accepted and `remainingdays`
 * is positive (923: 2026.05.29 / +117). Deciding from the dates showed the
 * first three and hid the last four; the status alone reproduces the counts
 * the owner sees in production (Шунхлай ХХК 6, трейдинг 2).
 */
export const ACCEPTING_STATUS = 5;

export function isPostingOpen(status: number | null | undefined): boolean {
  return Number(status) === ACCEPTING_STATUS;
}

/**
 * The countdown shown beside an advert, never negative.
 *
 * The closing date is preferred while it is still ahead; otherwise the
 * backend's own `remainingdays` is taken when it is positive (the four rows
 * above are dated in the past yet still accepting, and the ERP's count is what
 * their advert claims). When neither is a future number there is nothing
 * honest to show — an open-ended advert, or one that is no longer taking
 * applications — and it is `null`.
 */
export function remainingDaysFor(
  advenddate: string | null | undefined,
  reported: number | null | undefined,
  now?: Date,
): number | null {
  const computed = daysUntilClose(advenddate, now);
  if (computed != null && computed >= 0) return computed;
  const backend = finiteDays(reported);
  return backend != null && backend >= 0 ? backend : null;
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
    positionTypeId: row.postypeid ?? 0,
    statusId: row.status ?? 0,
    status: (row.statusname ?? "").trim(),
    // `||`, not `??`: the backend sends "" for a date it does not have, and
    // an empty advert start date must still fall through to the request date
    // or the row sorts to the bottom of the list forever.
    postedAt: row.advbegindate || row.requestdate || "",
    closesAt: row.advenddate ?? "",
    // `null` means there is no deadline worth showing, not that it closes
    // today — leave it unset instead of collapsing to 0.
    remainingDays: remainingDaysFor(row.advenddate, row.remainingdays),
    isOpen: isPostingOpen(row.status),
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
