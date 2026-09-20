import { APPLICANT_BASE } from "./core/config";
import { apiGet, apiPost, apiUpload } from "./core/request";

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

/** GET /api/applicant/get */
export async function getProfile(): Promise<ApplicantProfile> {
  return unwrapProfile(await apiGet<unknown>(`${APPLICANT_BASE}/get`));
}

/**
 * Loaded keys that are derived, display-only or heavy: never echoed back.
 * Everything else the record carries IS echoed, because SaveHrApplicant is a
 * full replace — an omitted field is reset (licence flags to false, custom1/2
 * to null, addr2 to "").
 */
const NOT_ECHOED = new Set([
  "maritalOptions",
  "picturedata",
  "filedata",
  "filename",
  "countryname",
  "divisionname",
  "districtname",
  "relativename",
  "relativename2",
]);

/**
 * Fields where blank must be left out rather than sent. Identity: a blank
 * regno/mobilephone would wipe the ERP's copy. Numeric ids: null and "" are
 * HTTP 400 (relativeid) or a silent null (countryid).
 */
const OMIT_WHEN_BLANK = new Set([
  "regno",
  "mobilephone",
  "relativeid",
  "relativeid2",
  "countryid",
  "divisionid",
  "districtid",
]);

const isCompletion = (key: string) => key.endsWith("per");

const isEchoed = (key: string) => !NOT_ECHOED.has(key) && !isCompletion(key);

const isNil = (value: unknown) => value === null || value === undefined;

const isBlank = (value: unknown) => isNil(value) || String(value).trim() === "";

const isSendable = (key: string, value: unknown) =>
  !isNil(value) && !(OMIT_WHEN_BLANK.has(key) && isBlank(value));

/**
 * The exact body for `SaveHrApplicant`: the loaded record's echoed keys
 * (including ones this client has no field for), overlaid by the edited
 * values, with everything the backend would reject or misread left out.
 */
export function buildProfilePayload(
  input: ProfileInput,
  loaded?: ApplicantProfile | null,
): Record<string, unknown> {
  const echoed = Object.entries(loaded ?? {}).filter(([key]) => isEchoed(key));
  const merged = { ...Object.fromEntries(echoed), ...input };
  return Object.fromEntries(Object.entries(merged).filter(([key, v]) => isSendable(key, v)));
}

/** POST /api/applicant/SaveHrApplicant */
export function saveProfile(body: ProfileInput, loaded?: ApplicantProfile | null) {
  return apiPost<unknown>(`${APPLICANT_BASE}/SaveHrApplicant`, buildProfilePayload(body, loaded));
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
