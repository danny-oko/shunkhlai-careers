import { APPLICANT_BASE } from "./core/config";
import { apiGet, apiGetList } from "./core/request";

/**
 * Open postings. Public — no token — which is what lets the careers pages
 * render on the server.
 */

/** One row of `getRecruitmentOrderList`. */
export type JobListRow = {
  entryid: number;
  posname: string;
  locname: string;
  companyname: string;
  companyid: string;
  postypeid: number;
  postype: string;
  posgroupid: number;
  posgroupname: string;
  worktype: string;
  requestdate: string;
  advbegindate: string;
  advenddate: string;
  status: number;
  statusname: string;
  /** Days left before the advert closes; negative once it has. */
  remainingdays: number;
};

/** The posting record inside `getRecruitmentOrderItem`. */
export type JobOrder = JobListRow & {
  mapurl?: string | null;
  salarylevel?: string | null;
  levelname?: string | null;
  quantity?: number;
  addreq?: string | null;
  /** JSON strings holding `{ text }` arrays — `mainreq`/`mainresp` are the parsed form. */
  orderreq?: string | null;
  orderres?: string | null;
};

export type JobDetail = {
  hrrecruitmentorder: JobOrder[];
  /** Main responsibilities, one `name` per row. */
  mainresp: Array<{ name: string }>;
  /** Main requirements, one `name` per row. */
  mainreq: Array<{ name: string }>;
};

/** Everything the job-search filters are built from, in one call. */
export type JobFilterData = {
  location: Array<{
    entryid: number;
    name: string;
    divisionname: string;
    districtname: string;
    code: string;
    divisionid: number;
    districtid: number;
  }>;
  salarylevel: Array<{ key: number; text: string }>;
  smcompany: Array<{ companyid: string; name: string }>;
  hrposgroup: Array<{ posgroupid: number; name: string }>;
  positiontype: Array<{ valuestr: number; name: string }>;
};

export type JobQuery = {
  /** Search by position name. */
  jobName?: string;
  /** Location id from `JobFilterData.location`; `0` means every location. */
  locationid?: number;
  /** Salary band key from `JobFilterData.salarylevel`. */
  salaryLevelID?: number | string;
};

/** GET /api/applicant/getRecruitmentOrderList */
export function listOrders(query: JobQuery = {}) {
  return apiGetList<JobListRow>(
    `${APPLICANT_BASE}/getRecruitmentOrderList`,
    {
      jobName: query.jobName ?? "",
      locationid: query.locationid ?? 0,
      salaryLevelID: query.salaryLevelID ?? "",
    },
    { skipAuth: true },
  );
}

/** GET /api/applicant/getRecruitmentOrderItem — note the capital `ID`. */
export function getOrder(entryID: number | string) {
  return apiGet<JobDetail>(
    `${APPLICANT_BASE}/getRecruitmentOrderItem`,
    { entryID },
    { skipAuth: true },
  );
}

/** GET /api/applicant/getDropDownData */
export function filterData() {
  return apiGet<JobFilterData>(`${APPLICANT_BASE}/getDropDownData`, undefined, {
    skipAuth: true,
  });
}
