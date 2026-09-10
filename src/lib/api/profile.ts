import { APPLICANT_BASE } from "./core/config";
import { apiGet, apiPost, apiUpload } from "./core/request";

/**
 * The applicant's core record and their two file uploads. Section data
 * (education, experience, …) lives in `sections.ts`.
 */

export type ApplicantProfileInput = {
  firstname: string;
  lastname: string;
  regno: string;
  mobilephone: string;
  countryid: number;
  divisionid: number;
  districtid: number;
  [key: string]: unknown;
};

/** GET /api/applicant/get — the signed-in applicant's full saved profile. */
export function getProfile<T = unknown>() {
  return apiGet<T>(`${APPLICANT_BASE}/get`);
}

/** POST /api/applicant/SaveHrApplicant */
export function saveProfile(body: ApplicantProfileInput) {
  return apiPost<unknown>(`${APPLICANT_BASE}/SaveHrApplicant`, body);
}

/**
 * GET /api/applicant/GetFindAppInfoFromRegno — derives date of birth and
 * birthplace from a register number, so sign-up can pre-fill them. Auth: none.
 */
export function lookupByRegisterNumber<T = unknown>(regno: string) {
  return apiGet<T>(`${APPLICANT_BASE}/GetFindAppInfoFromRegno`, { regno }, { skipAuth: true });
}

/** POST /api/applicant/SaveAppPicture — multipart, one image. */
export function uploadPhoto(file: File) {
  return apiUpload<unknown>(`${APPLICANT_BASE}/SaveAppPicture`, file);
}

/**
 * POST /api/applicant/SaveAppCV — multipart, one file. The backend keeps only
 * the last file in the request, so never send more than one.
 */
export function uploadCv(file: File) {
  return apiUpload<unknown>(`${APPLICANT_BASE}/SaveAppCV`, file);
}

/** POST /api/applicant/deleteAppCV */
export function deleteCv() {
  return apiPost<unknown>(`${APPLICANT_BASE}/deleteAppCV`);
}
