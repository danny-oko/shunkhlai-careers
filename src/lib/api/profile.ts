import { RETRY_LINK_FLAG } from "@/lib/applicant-identity";

import { ME_BASE } from "./core/config";
import { apiGet, apiPost, apiUpload } from "./core/request";
import { buildProfilePayload } from "./profile-payload";

export { buildProfilePayload };

/**
 * The applicant's core record. One call returns the personal details, the
 * profile photo, the CV *and* the per-section completion percentages — there
 * is no separate endpoint for downloading a CV.
 */

export type MaritalOption = { key: string; text: string };

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
  /** Driver's licence classes A-E. */
  isa?: boolean;
  isb?: boolean;
  isc?: boolean;
  isd?: boolean;
  ise?: boolean;
  /** The two free-text "Бусад" answers (relatives at the company / БВМ referral). */
  custom1?: string | null;
  custom2?: string | null;
  /**
   * The `maritalstatus[]` list the real backend returns beside the record.
   * Client-side only — `getProfile` attaches it, it is never sent back.
   */
  maritalOptions?: MaritalOption[];
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
  /**
   * `/api/me` only: the account is linked to an ERP record, so the регистр
   * can no longer change. Never sent back.
   */
  erplinked?: boolean;
  /** `/api/me` only: the ERP's refusal of the stored регистр + утас, else null. */
  erplinkerror?: string | null;
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
  isa?: boolean;
  isb?: boolean;
  isc?: boolean;
  isd?: boolean;
  ise?: boolean;
  custom1?: string;
  custom2?: string;
};

type Wrapped = { applicantdata: ApplicantProfile[]; maritalstatus?: unknown };

const isWrapped = (data: unknown): data is Wrapped =>
  typeof data === "object" && data !== null && Array.isArray((data as Wrapped).applicantdata);

const maritalList = (wrapped: Wrapped): MaritalOption[] | undefined =>
  Array.isArray(wrapped.maritalstatus) ? (wrapped.maritalstatus as MaritalOption[]) : undefined;

const fromWrapped = (wrapped: Wrapped): ApplicantProfile => ({
  ...(wrapped.applicantdata[0] ?? {}),
  maritalOptions: maritalList(wrapped),
});

/**
 * The real backend nests the record under `applicantdata` (with siblings
 * `recruitmentorders`, `maritalstatus`); the mock returns it flat. Unwrap so
 * every field — name, regno, phone, email, address, contacts, picturedata —
 * maps into the form either way.
 */
export function unwrapProfile(data: unknown): ApplicantProfile {
  if (!isWrapped(data)) return (data ?? {}) as ApplicantProfile;
  return fromWrapped(data);
}

/** GET /api/me/get */
export async function getProfile(): Promise<ApplicantProfile> {
  return unwrapProfile(await apiGet<unknown>(`${ME_BASE}/get`));
}

/**
 * POST /api/me/SaveHrApplicant. `retryLink`: the applicant asked to try the
 * ERP again with a регистр + утас it refused (the identity form / banner only;
 * an ordinary profile save never lifts the refusal — see `RETRY_LINK_FLAG`).
 */
export function saveProfile(
  body: ProfileInput,
  loaded?: ApplicantProfile | null,
  options: { retryLink?: boolean } = {},
) {
  const payload = buildProfilePayload(body, loaded);
  if (options.retryLink) payload[RETRY_LINK_FLAG] = true;
  return apiPost<unknown>(`${ME_BASE}/SaveHrApplicant`, payload);
}

/** POST /api/me/SaveAppPicture */
export function uploadPhoto(file: File) {
  return apiUpload<unknown>(`${ME_BASE}/SaveAppPicture`, file);
}

/** POST /api/me/SaveAppCV — one CV per applicant; re-uploading replaces it. */
export function uploadCv(file: File) {
  return apiUpload<unknown>(`${ME_BASE}/SaveAppCV`, file);
}

/** POST /api/me/deleteAppCV — no parameters; the Clerk session identifies the applicant. */
export function deleteCv() {
  return apiPost<unknown>(`${ME_BASE}/deleteAppCV`);
}

/** Turns the Base64 photo from `getProfile` into something `<img src>` accepts. */
export function pictureSrc(profile: Pick<ApplicantProfile, "picturedata">): string | null {
  const data = profile.picturedata;
  if (!data) return null;
  return data.startsWith("data:") ? data : `data:image/jpeg;base64,${data}`;
}
