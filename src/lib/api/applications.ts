import { APPLICANT_BASE } from "./core/config";
import { apiGetList, apiPost } from "./core/request";

/**
 * Applying to a posting, tracking what was sent, and registering interest in
 * roles that are not advertised yet. All of it needs a session — the backend
 * reads the applicant from the token and attaches their CV automatically.
 */

export type ApplicationInput = {
  /** The posting's `entryid` from the job list. */
  recruitmentorderid: number;
  /** Source channel, e.g. `WEB`. */
  sourcetype: string;
  /** Salary expectation, in tögrög. */
  salrequest: number;
  /** Earliest start date, `YYYY-MM-DD`. */
  poshiredate: string;
  /** "Where did you hear about us", from `reference.sources()`. */
  recsourceid: number;
};

/** One row of `getRecruitmenRequestList` (note: no `t` in "Recruitmen"). */
export type ApplicationRow = {
  /** The request's own id — this is what `withdraw` deletes. */
  entryid: number;
  /** The posting the request was sent to, i.e. an `entryid` from the job list. */
  recruitmentorderid?: number | string;
  posname: string;
  companyname: string;
  locname: string;
  salaryname?: string;
  availabledate?: string;
  statusid?: number;
  statusname?: string;
  [extra: string]: unknown;
};

export type InterestedJobRow = {
  entryid: number;
  posgroupid?: number;
  posgroupname?: string;
  positionid?: number | null;
  positionname?: string;
  depid?: string | number | null;
  depname?: string;
  [extra: string]: unknown;
};

export type InterestedJobInput = {
  /** 0 inserts. */
  entryid: number;
  posgroupid: number;
  positionid?: number | null;
  depid?: string | number | null;
};

/** POST /api/applicant/SaveHrRecruitmentOrderApp */
export function apply(body: ApplicationInput) {
  return apiPost<unknown>(`${APPLICANT_BASE}/SaveHrRecruitmentOrderApp`, body);
}

/** GET /api/applicant/getRecruitmenRequestList */
export function listMine() {
  return apiGetList<ApplicationRow>(`${APPLICANT_BASE}/getRecruitmenRequestList`);
}

/** POST /api/applicant/DeleteOrderApp?entryID= — withdraws an application. */
export function withdraw(entryID: number) {
  return apiPost<unknown>(`${APPLICANT_BASE}/DeleteOrderApp`, undefined, {
    params: { entryID },
  });
}

/** GET /api/applicant/getInterestedJobsList */
export function listInterests() {
  return apiGetList<InterestedJobRow>(`${APPLICANT_BASE}/getInterestedJobsList`);
}

/** POST /api/applicant/SaveInterestedJobItem */
export function saveInterest(body: InterestedJobInput) {
  return apiPost<unknown>(`${APPLICANT_BASE}/SaveInterestedJobItem`, body);
}

/** POST /api/applicant/deleteInterestedJob?entryid= */
export function deleteInterest(entryid: number) {
  return apiPost<unknown>(`${APPLICANT_BASE}/deleteInterestedJob`, undefined, {
    params: { entryid },
  });
}
