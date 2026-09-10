import { APPLICANT_BASE } from "./core/config";
import { apiGetList, apiPost } from "./core/request";

/**
 * Applying, tracking applications, and job-interest subscriptions.
 *
 * Everything here except the internship registration needs a session: the
 * backend reads the applicant from the token rather than from the body.
 */

export type ApplicationInput = {
  recruitmentorderid: number;
  /** Where the applicant came from; pairs with `recsourceid`. */
  sourcetype: string;
  /** Salary expectation, in tögrög. */
  salrequest?: number;
  /** Earliest start date, ISO `YYYY-MM-DD`. */
  poshiredate?: string;
  recsourceid?: number;
};

export type InterestedJobInput = {
  entryid: number;
  posgroupid: number;
  depid: number;
  positionid: number;
};

export type InternshipStudentInput = {
  prsid: number;
  lastname: string;
  firstname: string;
  regno: string;
  professionid: number;
  email: string;
  mobilephone: string;
  universityid: number;
  fromdate: string;
  educationlevelid: number;
  /** Placement length in months. */
  internduration: number;
};

/** POST /api/applicant/SaveHrRecruitmentOrderApp — apply to a posting. */
export function apply(body: ApplicationInput) {
  return apiPost<unknown>(`${APPLICANT_BASE}/SaveHrRecruitmentOrderApp`, body);
}

/** GET /api/applicant/getRecruitmenRequestList — the applicant's own applications. */
export function listMine<T = unknown>() {
  return apiGetList<T>(`${APPLICANT_BASE}/getRecruitmenRequestList`);
}

/** POST /api/applicant/DeleteOrderApp — withdraw an application. */
export function withdraw(body: { entryid: number; [key: string]: unknown }) {
  return apiPost<unknown>(`${APPLICANT_BASE}/DeleteOrderApp`, body);
}

/** GET /api/applicant/getInterestedJobsList */
export function listInterests<T = unknown>(appId?: number) {
  return apiGetList<T>(
    `${APPLICANT_BASE}/getInterestedJobsList`,
    appId === undefined ? undefined : { appId },
  );
}

/** POST /api/applicant/SaveInterestedJobItem — subscribe to a job category. */
export function saveInterest(body: InterestedJobInput) {
  return apiPost<unknown>(`${APPLICANT_BASE}/SaveInterestedJobItem`, body);
}

/** POST /api/applicant/deleteInterestedJob */
export function deleteInterest(body: { entryid: number; [key: string]: unknown }) {
  return apiPost<unknown>(`${APPLICANT_BASE}/deleteInterestedJob`, body);
}

/**
 * POST /api/applicant/SaveHrPractiserStudent — internship/practicum sign-up.
 * A separate pipeline from job applications, and it needs no session.
 */
export function registerInternshipStudent(body: InternshipStudentInput) {
  return apiPost<unknown>(`${APPLICANT_BASE}/SaveHrPractiserStudent`, body, {
    skipAuth: true,
  });
}

/* -------------------------------------------------------------------------
   Easy Apply
   ------------------------------------------------------------------------
   The site's one-screen apply form has no matching endpoint in the reference.
   The documented path is four authenticated calls:

     account.register() → auth.signIn() → profile.uploadCv() → apply()

   Until that flow exists, the form posts its FormData to the path below and
   falls back to a local success when nothing answers. Point EASY_APPLY_PATH
   at whatever the backend team stands up, or replace this function with the
   four-call sequence. */

export const EASY_APPLY_PATH = "/applications";

export function submitEasyApplication(payload: FormData) {
  return apiPost<unknown>(EASY_APPLY_PATH, payload, { skipAuth: true });
}
