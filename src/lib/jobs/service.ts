import * as jobsApi from "@/lib/api/jobs";
import { hasLiveBackend } from "@/lib/api/core/config";

import { recruitmentOrderFixtures } from "./fixtures";
import { parseJobId, toJob, toJobs } from "./mapper";
import type { Job } from "./types";

/**
 * What the pages call. Endpoint modules return the backend's DTOs; this layer
 * returns `Job`s, and is the boundary the rest of the app is allowed to see.
 *
 * These run on the server (the posting endpoints are public), so the careers
 * pages stay server-rendered and indexable. Nothing here is cached: `fetch`
 * is uncached by default in this version of Next, and axios never was. If
 * postings should be cached, enable `cacheComponents` in `next.config.ts` and
 * wrap these functions with `use cache` — no call site has to change.
 */

/** Open full-time postings, newest first. */
export async function listJobs(query: jobsApi.FullTimeJobQuery = {}): Promise<Job[]> {
  if (!hasLiveBackend()) {
    // Fixture mode ignores server-side filters; the UI filters client-side.
    return toJobs(recruitmentOrderFixtures);
  }
  return toJobs(await jobsApi.listFullTime(query));
}

/**
 * Same, but answers with an empty list instead of throwing.
 *
 * For surfaces where postings are a garnish rather than the point — the
 * landing page's role count and shortlist — a recruitment API outage should
 * not take the page down with it.
 */
export async function listJobsSafe(query: jobsApi.FullTimeJobQuery = {}): Promise<Job[]> {
  try {
    return await listJobs(query);
  } catch (error) {
    console.error("[jobs] could not load postings", error);
    return [];
  }
}

/** One posting, addressed by either its slug (`4-station-manager`) or its raw id. */
export async function getJob(slugOrId: string): Promise<Job | null> {
  const id = parseJobId(slugOrId) ?? slugOrId;

  if (!hasLiveBackend()) {
    const dto = recruitmentOrderFixtures.find((order) => String(order.entryid) === id);
    return dto ? toJob(dto) : null;
  }

  try {
    return toJob(await jobsApi.getOrder(id));
  } catch (error) {
    console.error(`[jobs] could not load posting ${id}`, error);
    return null;
  }
}
