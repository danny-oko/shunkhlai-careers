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
    remainingDays: row.remainingdays ?? 0,
    isOpen: (row.remainingdays ?? 0) >= 0,
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
 */
export function toJobDetail(dto: JobDetailDto): JobDetail | null {
  const order = dto?.hrrecruitmentorder?.[0];
  if (!order?.entryid || !order.posname) return null;

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
