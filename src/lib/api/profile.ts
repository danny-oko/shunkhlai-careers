import { APPLICANT_BASE } from "./core/config";
import { apiGet, apiPost, apiUpload } from "./core/request";

/**
 * The applicant's core record. One call returns the personal details, the
 * profile photo, the CV *and* the per-section completion percentages — there
 * is no separate endpoint for downloading a CV.
 */

export type ApplicantProfile = {
  lastname?: string;
  firstname?: string;
  regno?: string;
  mobilephone?: string;
  email2?: string;
  addr2?: string;
  maritalstatus?: string;
  countryid?: number;
  countryname?: string;
  divisionid?: number;
  divisionname?: string;
  districtid?: number;
  districtname?: string;
  contactname?: string;
  relativeid?: number | null;
  relativename?: string;
  contactphone?: string;
  contactname2?: string;
  relativeid2?: number | null;
  relativename2?: string;
  contactphone2?: string;
  /** Base64 profile photo. */
  picturedata?: string | null;
  /** CV file name and Base64 contents. */
  filename?: string | null;
  filedata?: string | null;
  /** Completion percentages, 0-100. */
  persinfoper?: number;
  educationper?: number;
  experienceper?: number;
  distinctper?: number;
  familyper?: number;
  totalper?: number;
  [extra: string]: unknown;
};

export type ProfileInput = {
  lastname: string;
  firstname: string;
  regno: string;
  mobilephone: string;
  maritalstatus?: string;
  email2?: string;
  addr2?: string;
  countryid?: number | null;
  divisionid?: number | null;
  districtid?: number | null;
  contactname?: string;
  relativeid?: number | null;
  contactphone?: string;
  contactname2?: string;
  relativeid2?: number | null;
  contactphone2?: string;
};

/** GET /api/applicant/get */
export function getProfile() {
  return apiGet<ApplicantProfile>(`${APPLICANT_BASE}/get`);
}

/** POST /api/applicant/SaveHrApplicant */
export function saveProfile(body: ProfileInput) {
  return apiPost<unknown>(`${APPLICANT_BASE}/SaveHrApplicant`, body);
}

/** POST /api/applicant/SaveAppPicture — the server makes a full and a thumbnail copy. */
export function uploadPhoto(file: File) {
  return apiUpload<unknown>(`${APPLICANT_BASE}/SaveAppPicture`, file);
}

/** POST /api/applicant/SaveAppCV — one CV per applicant; re-uploading replaces it. */
export function uploadCv(file: File) {
  return apiUpload<unknown>(`${APPLICANT_BASE}/SaveAppCV`, file);
}

/** POST /api/applicant/deleteAppCV — no parameters; the token identifies the applicant. */
export function deleteCv() {
  return apiPost<unknown>(`${APPLICANT_BASE}/deleteAppCV`);
}

/** Turns the Base64 photo from `getProfile` into something `<img src>` accepts. */
export function pictureSrc(profile: Pick<ApplicantProfile, "picturedata">): string | null {
  const data = profile.picturedata;
  if (!data) return null;
  return data.startsWith("data:") ? data : `data:image/jpeg;base64,${data}`;
}
