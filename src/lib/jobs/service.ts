import * as jobsApi from "@/lib/api/jobs";
import type { JobFilterData, JobQuery } from "@/lib/api/jobs";
import { hasLiveBackend } from "@/lib/api/core/config";

import { parseApiDate, parseJobId, toJobDetail, toJobs } from "./mapper";
import type { Job, JobDetail } from "./types";

/**
 * What the pages call. The endpoint module returns the backend's rows; this
 * returns `Job`s.
 *
 * These run on the server — the posting endpoints need no token — so the
 * careers pages stay server-rendered and indexable.
 */

type JobEndpoints = Pick<typeof jobsApi, "listOrders" | "getOrder" | "filterData">;

/**
 * Where a server render reads postings from.
 *
 * With a backend configured it is the HTTP client. Without one the postings
 * live in this app's own mock routes, which a server render cannot call over
 * HTTP — so it reads their store directly instead. The import is dynamic to
 * keep the mock data out of the browser bundle.
 */
async function endpoints(): Promise<JobEndpoints> {
  if (hasLiveBackend() || typeof window !== "undefined") return jobsApi;
  return import("./local");
}

/** Newest advert first. */
function byNewest(a: Job, b: Job): number {
  const left = parseApiDate(a.postedAt)?.getTime() ?? 0;
  const right = parseApiDate(b.postedAt)?.getTime() ?? 0;
  return right - left;
}

export async function listJobs(query: JobQuery = {}): Promise<Job[]> {
  const rows = await (await endpoints()).listOrders(query);
  return toJobs(rows).sort(byNewest);
}

/**
 * Same, but answers with an empty list instead of throwing — for surfaces
 * where postings are a garnish (the landing page's count and shortlist) and an
 * API outage should not take the page down.
 */
export async function listJobsSafe(query: JobQuery = {}): Promise<Job[]> {
  try {
    return await listJobs(query);
  } catch (error) {
    console.error("[jobs] could not load postings", error);
    return [];
  }
}

/** One posting, addressed by slug (`786-…`) or by raw id. */
export async function getJob(slugOrId: string): Promise<JobDetail | null> {
  const id = parseJobId(slugOrId) ?? slugOrId;

  try {
    return toJobDetail(await (await endpoints()).getOrder(id));
  } catch (error) {
    console.error(`[jobs] could not load posting ${id}`, error);
    return null;
  }
}

/** Location and salary options for the server-side filters. */
export async function getFilterData(): Promise<JobFilterData | null> {
  try {
    return await (await endpoints()).filterData();
  } catch (error) {
    console.error("[jobs] could not load filter data", error);
    return null;
  }
}
