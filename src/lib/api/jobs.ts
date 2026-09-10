import { APPLICANT_BASE } from "./core/config";
import { apiGet, apiGetList, apiPost } from "./core/request";

/**
 * Public job postings. These are the only applicant endpoints that need no
 * session, which is what lets the careers pages render on the server.
 *
 * The endpoint reference documents request parameters but not response
 * bodies, so the DTO below lists the fields a recruitment order plausibly
 * carries and stays open-ended. Everything downstream reads the DTO through
 * `src/lib/jobs/mapper.ts`, so when a real response lands, that one mapper is
 * the only thing to correct.
 */

export type RecruitmentOrderDto = {
  entryid?: number | string;
  entryID?: number | string;
  jobname?: string;
  jobName?: string;
  positionname?: string;
  depname?: string;
  departmentname?: string;
  companyname?: string;
  companyID?: string;
  locationname?: string;
  locationid?: number | string;
  countryname?: string;
  worktype?: string;
  worktypename?: string;
  salary?: string;
  salaryLevelID?: string;
  salarylevelname?: string;
  experience?: string;
  expyear?: number | string;
  brieftext?: string;
  description?: string;
  requirement?: string;
  duty?: string;
  benefit?: string;
  begindate?: string;
  enddate?: string;
  regdate?: string;
  [key: string]: unknown;
};

export type FullTimeJobQuery = {
  jobName?: string;
  locationid?: number | string;
  salaryLevelID?: string;
};

export type PartTimeJobQuery = {
  companyID?: string[];
  locationID?: number;
};

/** GET /api/applicant/getRecruitmentOrderList — open full-time postings. */
export function listFullTime(query: FullTimeJobQuery = {}) {
  return apiGetList<RecruitmentOrderDto>(
    `${APPLICANT_BASE}/getRecruitmentOrderList`,
    query,
    { skipAuth: true },
  );
}

/** POST /api/applicant/getRecOrderPartTimeList — open part-time postings. */
export function listPartTime(query: PartTimeJobQuery = {}) {
  return apiPost<RecruitmentOrderDto[]>(
    `${APPLICANT_BASE}/getRecOrderPartTimeList`,
    query,
    { skipAuth: true },
  );
}

/** GET /api/applicant/getRecruitmentOrderItem — full detail for one posting. */
export function getOrder(entryID: number | string) {
  return apiGet<RecruitmentOrderDto>(
    `${APPLICANT_BASE}/getRecruitmentOrderItem`,
    { entryID },
    { skipAuth: true },
  );
}

/**
 * GET /api/applicant/getDropDownData — the bundle of locations, salary bands
 * and companies the job-search filters are built from.
 */
export function filterData<T = unknown>() {
  return apiGet<T>(`${APPLICANT_BASE}/getDropDownData`, undefined, { skipAuth: true });
}
