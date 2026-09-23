import { ME_BASE } from "./core/config";
import { apiGetList, apiPost } from "./core/request";

/**
 * Applying to a posting, tracking what was sent, and registering interest in
 * roles that are not advertised yet. All of it needs a session — `/api/me`
 * reads the applicant from the Clerk session and stores it in D1.
 */

export type ApplicationInput = {
  /** The posting's `entryid` from the job list. */
  recruitmentorderid: number;
  /** Source channel, e.g. `WEB`. */
  sourcetype: string;
  /**
   * Salary-level KEY — the `key` of a `getDropDownData.salarylevel` band, not
   * an amount. The column is NUMBER(2): a tögrög figure fails with ORA-01438.
   * Omit when the applicant chose none.
   */
  salrequest?: number;
  /** Earliest start date, `YYYY-MM-DD`. */
  poshiredate: string;
  /** "Where did you hear about us", from `reference.sources()`. */
  recsourceid: number;
};

/** One row of `getRecruitmenRequestList` (note: no `t` in "Recruitmen"). */
export type ApplicationRow = {
  /** The request's own id — this is what `withdraw` deletes. */
  entryid: number;
  posname: string;
  companyname: string;
  locname: string;
  salaryname?: string;
  availabledate?: string;
  statusid?: number;
  statusname?: string;
  /**
   * The posting — only on rows submitted on this site: the ERP's list carries
   * none, so an ERP row can only be matched by name and location (`jobs/apply.ts`).
   */
  recruitmentorderid?: number;
  /** `yyyy.mm.dd`, on rows submitted on this site. */
  senddate?: string;
  /** Push state kept by `/api/me` (`pending` | `sent` | `failed` | `skipped`). */
  erp?: { status?: string; erpEntryId?: number };
  /** The ERP's own refusal of the last «Цуцлах» (its retmsg), from `/api/me`. */
  withdrawerror?: string;
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

/** POST /api/me/SaveHrRecruitmentOrderApp */
export function apply(body: ApplicationInput) {
  return apiPost<unknown>(`${ME_BASE}/SaveHrRecruitmentOrderApp`, body);
}

/** GET /api/me/getRecruitmenRequestList */
export function listMine() {
  return apiGetList<ApplicationRow>(`${ME_BASE}/getRecruitmenRequestList`);
}

/** POST /api/me/DeleteOrderApp?entryID= — withdraws an application. */
export function withdraw(entryID: number) {
  return apiPost<unknown>(`${ME_BASE}/DeleteOrderApp`, undefined, {
    params: { entryID },
  });
}

/** GET /api/me/getInterestedJobsList */
export function listInterests() {
  return apiGetList<InterestedJobRow>(`${ME_BASE}/getInterestedJobsList`);
}

/** POST /api/me/SaveInterestedJobItem */
export function saveInterest(body: InterestedJobInput) {
  return apiPost<unknown>(`${ME_BASE}/SaveInterestedJobItem`, body);
}

/** POST /api/me/deleteInterestedJob?entryid= */
export function deleteInterest(entryid: number) {
  return apiPost<unknown>(`${ME_BASE}/deleteInterestedJob`, undefined, {
    params: { entryid },
  });
}
