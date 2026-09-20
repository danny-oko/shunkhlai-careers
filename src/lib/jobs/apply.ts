import type { ApplicationInput, ApplicationRow } from "@/lib/api/applications";
import type { JobFilterData } from "@/lib/api/jobs";
import { salaryLevelKeySchema } from "@/lib/apply-schema";

import type { Job } from "./types";

/**
 * The pure parts of applying, kept out of the dialog so they can be tested.
 *
 * What the live backend does, and what follows from it:
 *  - `salrequest` is a salary-level key, NUMBER(2) — see `salaryLevelKeySchema`.
 *  - A non-existent posting id answers success and creates nothing, so success
 *    is only believed once the applicant's list shows a new row.
 *  - A second application to the same posting is accepted (another row), and
 *    list rows carry no posting id, so duplicates are matched by name.
 *  - A past start date is accepted, so the client guards it.
 */

export type SalaryBand = { key: number; text: string };

/** The bands the applicant may pick, as the API sent them. */
export function salaryBands(filterData: JobFilterData | null): SalaryBand[] {
  return (filterData?.salarylevel ?? []).filter(
    (band) => band && Number.isInteger(band.key) && typeof band.text === "string",
  );
}

const SALARY_ERROR = "Цалингийн түвшингээ жагсаалтаас сонгоно уу.";

export type SalaryChoice = { ok: true; key: number | undefined } | { ok: false; message: string };

/**
 * Turns the select's value into a `salrequest`. Empty means "no preference"
 * and is omitted from the payload. A value that is not one of the loaded
 * bands is rejected, so a typed amount can never reach the backend.
 */
export function parseSalaryChoice(value: string, bands: SalaryBand[]): SalaryChoice {
  if (!value.trim()) return { ok: true, key: undefined };
  const key = listedKey(value, bands);
  return key === null ? { ok: false, message: SALARY_ERROR } : { ok: true, key };
}

/** The key when `value` is a valid key naming one of `bands`, else null. */
function listedKey(value: string, bands: SalaryBand[]): number | null {
  const parsed = salaryLevelKeySchema.safeParse(Number(value));
  const listed = parsed.success && bands.some((band) => band.key === parsed.data);
  return listed ? parsed.data : null;
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `YYYY-MM-DD` strictly before today's local date. Unparseable counts as not-past. */
export function isPastDate(iso: string, now = new Date()): boolean {
  const match = ISO_DATE.exec(iso);
  if (!match) return false;
  const day = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return day.getTime() < today.getTime();
}

/** The request body. `salrequest` is left out entirely when unset. */
export function buildApplicationInput(args: {
  postingId: number;
  salaryKey: number | undefined;
  poshiredate: string;
  recsourceid: number;
}): ApplicationInput {
  return {
    recruitmentorderid: args.postingId,
    sourcetype: "WEB",
    ...(args.salaryKey === undefined ? {} : { salrequest: args.salaryKey }),
    poshiredate: args.poshiredate,
    recsourceid: args.recsourceid,
  };
}

function norm(value: string | undefined | null): string {
  return (value ?? "").trim().toLocaleLowerCase("mn");
}

/** Does this list row look like an application to this posting? Name + location. */
export function isSamePosting(row: ApplicationRow, job: Pick<Job, "title" | "location">): boolean {
  return norm(row.posname) === norm(job.title) && norm(row.locname) === norm(job.location);
}

/** The applicant's existing application to this posting, if any. */
export function findDuplicateApplication(
  rows: ApplicationRow[],
  job: Pick<Job, "title" | "location">,
): ApplicationRow | undefined {
  return rows.find((row) => isSamePosting(row, job));
}

/**
 * Did the apply call really create a row? A row counts as new when its
 * `entryid` was not in the list before and it matches this posting.
 */
export function applicationWasCreated(
  before: ApplicationRow[],
  after: ApplicationRow[],
  job: Pick<Job, "title" | "location">,
): boolean {
  const known = new Set(before.map((row) => Number(row.entryid)));
  return after.some((row) => !known.has(Number(row.entryid)) && isSamePosting(row, job));
}
