import { filterData as dropdownData, jobItem, jobList } from "@/server/mock/store";

import type { JobDetail, JobFilterData, JobListRow, JobQuery } from "@/lib/api/jobs";

/**
 * The mock backend, read in-process.
 *
 * With no `NEXT_PUBLIC_API_URL` the postings come from `src/app/api/applicant/**`.
 * A server render cannot reach those routes over HTTP — there is no origin to
 * address on a serverless host, and during a static build the deployment is not
 * serving yet — so the server-side job reads call the same store the routes do.
 * The browser still goes through the routes; only this path is short-circuited.
 *
 * Shapes match `@/lib/api/jobs` exactly: the mappers cannot tell the two apart.
 */

export async function listOrders(query: JobQuery = {}): Promise<JobListRow[]> {
  return jobList({
    jobName: query.jobName ?? "",
    locationid: Number(query.locationid) || 0,
    salaryLevelID: query.salaryLevelID ?? "",
  }) as JobListRow[];
}

export async function getOrder(entryID: number | string): Promise<JobDetail> {
  const item = jobItem(Number(entryID));
  if (!item) throw new Error(`Ажлын байр олдсонгүй: ${entryID}`);
  return item as unknown as JobDetail;
}

export async function filterData(): Promise<JobFilterData> {
  return dropdownData as unknown as JobFilterData;
}
