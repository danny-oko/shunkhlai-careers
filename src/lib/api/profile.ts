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
export async function getProfile(): Promise<ApplicantProfile> {
  const data = await apiGet<unknown>(`${APPLICANT_BASE}/get`);
  // The real backend nests the record under `applicantdata` (with siblings
  // `recruitmentorders`, `maritalstatus`); the mock returns it flat. Unwrap so
  // every field — name, regno, phone, email, address, contacts, picturedata —
  // maps into the form either way.
  if (data && typeof data === "object" && Array.isArray((data as { applicantdata?: unknown }).applicantdata)) {
    const list = (data as { applicantdata: ApplicantProfile[] }).applicantdata;
    return list[0] ?? {};
  }
  return (data ?? {}) as ApplicantProfile;
}

/** POST /api/applicant/SaveHrApplicant */
export function saveProfile(body: ProfileInput) {
  // The real backend rejects null for numeric fields (e.g. relativeid →
  // System.Decimal), returning HTTP 400. Send only the fields that have a
  // value; empty strings are fine for text. (The mock tolerated nulls.)
  const payload = Object.fromEntries(
    Object.entries(body).filter(([key, v]) => {
      if (v === null || v === undefined) return false;
      // Never send an EMPTY identity field: an empty regno/mobilephone would
      // blank the applicant's identity on the ERP (a create-or-update endpoint).
      if ((key === "regno" || key === "mobilephone") && String(v).trim() === "") {
        return false;
      }
      return true;
    }),
  );
  return apiPost<unknown>(`${APPLICANT_BASE}/SaveHrApplicant`, payload);
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
