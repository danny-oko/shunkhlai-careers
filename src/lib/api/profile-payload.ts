import type { ApplicantProfile, ProfileInput } from "./profile";

/**
 * Pure SaveHrApplicant payload builder, kept free of transport imports so
 * server code can share it with the browser client. `profile.ts` re-exports it.
 */

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
