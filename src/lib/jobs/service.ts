import { cache } from "react";
import { unstable_cache } from "next/cache";

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
 * How long a *successful* read of the recruitment API is reused across
 * requests.
 *
 * Postings, their detail and the filter options are public and identical for
 * every visitor, and the ERP is the slow, remote half of every careers render:
 * without this each visit to `/careers` made two round trips to it, and
 * `/careers/[id]` made the same one twice. The window is short because a
 * posting closing or opening is what a visitor came to see; the filter
 * options are reference data and change rarely, so they keep longer.
 *
 * `unstable_cache` stores only what its function returns. A read that throws
 * is never stored, so an outage is retried by the next visitor rather than
 * served back to them — which is the promise `/careers` makes in its own
 * comments. That is why the cached functions below throw, and the callers
 * further down are the ones that turn a throw into `null` or `[]`.
 */
const POSTINGS_REVALIDATE_S = 60;
const FILTERS_REVALIDATE_S = 300;

const cachedOrders = unstable_cache(
  (query: JobQuery) => jobsApi.listOrders(query),
  ["erp", "jobs", "list"],
  { revalidate: POSTINGS_REVALIDATE_S, tags: ["erp-jobs"] },
);

const cachedOrder = unstable_cache(
  (id: string) => jobsApi.getOrder(id),
  ["erp", "jobs", "item"],
  { revalidate: POSTINGS_REVALIDATE_S, tags: ["erp-jobs"] },
);

const cachedFilterData = unstable_cache(
  () => jobsApi.filterData(),
  ["erp", "jobs", "filters"],
  { revalidate: FILTERS_REVALIDATE_S, tags: ["erp-jobs"] },
);

/**
 * Where a server render reads postings from.
 *
 * With a backend configured it is the HTTP client, through the cache above.
 * Without one the postings live in this app's own mock routes, which a server
 * render cannot call over HTTP — so it reads their store directly instead,
 * uncached: it is in-process and free, and a developer editing the mock data
 * should see it at once. The import is dynamic to keep the mock data out of
 * the browser bundle.
 */
async function endpoints(): Promise<JobEndpoints> {
  if (hasLiveBackend()) {
    return {
      // The key is built from the query's *values*, so `{}` and the same
      // query spelled out in full share one entry instead of two.
      listOrders: (query = {}) =>
        cachedOrders({
          jobName: query.jobName ?? "",
          locationid: query.locationid ?? 0,
          salaryLevelID: query.salaryLevelID ?? "",
        }),
      getOrder: (id) => cachedOrder(String(id)),
      filterData: () => cachedFilterData(),
    };
  }
  if (typeof window !== "undefined") return jobsApi;
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

/**
 * One posting, addressed by slug (`786-…`) or by raw id.
 *
 * Wrapped in React's `cache` so that `generateMetadata` and the page, which
 * Next renders side by side, share one read instead of making two.
 */
export const getJob = cache(async (slugOrId: string): Promise<JobDetail | null> => {
  const id = parseJobId(slugOrId) ?? slugOrId;

  try {
    return toJobDetail(await (await endpoints()).getOrder(id), id);
  } catch (error) {
    console.error(`[jobs] could not load posting ${id}`, error);
    return null;
  }
});

/** Location and salary options for the server-side filters. */
export async function getFilterData(): Promise<JobFilterData | null> {
  try {
    return await (await endpoints()).filterData();
  } catch (error) {
    console.error("[jobs] could not load filter data", error);
    return null;
  }
}
