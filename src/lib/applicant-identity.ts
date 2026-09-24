import { PHONE_PATTERN, REGISTER_ID_PATTERN } from "@/lib/apply-rules";

/**
 * The four fields the ERP's SaveHrAppUser needs to create (or find) the
 * applicant: регистр, овог, нэр, утас. Nothing ERP-backed — анкет sections,
 * files, applying, interests — may happen until all four are filled. Shared by
 * the browser gate (`components/account/identity-gate.tsx`) and the `/api/me`
 * gate, so both agree on what "filled" means.
 */

export const IDENTITY_FIELDS = [
  ["regno", "Регистрийн дугаар"],
  ["lastname", "Овог"],
  ["firstname", "Нэр"],
  ["mobilephone", "Утас"],
] as const;

export type IdentityKey = (typeof IDENTITY_FIELDS)[number][0];

export type Identity = Record<IdentityKey, string>;

export const IDENTITY_REQUIRED_MESSAGE =
  "Эхлээд регистр, овог, нэр, утасны дугаараа бөглөнө үү.";

export const REGNO_LOCKED_MESSAGE =
  "Регистрийн дугаар ERP-ийн бүртгэлтэй холбогдсон тул өөрчлөх боломжгүй.";

/**
 * `SaveHrApplicant` body flag: the applicant asked to try the ERP again with
 * the stored регистр + утас after it refused them. Only the identity form /
 * banner sends it; `/api/me` takes it off the body (never stored, never sent
 * to the ERP). Without it an unchanged pair stays refused.
 */
export const RETRY_LINK_FLAG = "retrylink";

const filled = (value: unknown) =>
  value !== null && value !== undefined && String(value).trim() !== "";

/** The identity fields still blank in `profile`, in form order. */
export function missingIdentity(profile: Record<string, unknown> | null | undefined): IdentityKey[] {
  return IDENTITY_FIELDS.map(([key]) => key).filter((key) => !filled(profile?.[key]));
}

export const isIdentityComplete = (profile: Record<string, unknown> | null | undefined) =>
  missingIdentity(profile).length === 0;

/** Upper-cased and trimmed, as the ERP stores it (`УБ99010101`). */
export const normalizeRegno = (value: unknown) =>
  filled(value) ? String(value).trim().toUpperCase() : "";

/**
 * A Mongolian mobile as its 8 digits, which is how the ERP stores it and what
 * its login compares: spaces and dashes dropped, and a 976 country code only
 * when it is written "+976…" or makes an 11-digit number. Anything else is
 * only trimmed — it may be a password the ERP set some other way.
 */
export function normalizePhone(value: unknown): string {
  const text = filled(value) ? String(value).trim() : "";
  const compact = text.replace(/[\s-]/g, "");
  if (/^\+976\d{8}$/.test(compact)) return compact.slice(4);
  if (/^976\d{8}$/.test(compact)) return compact.slice(3);
  if (/^\d{8}$/.test(compact)) return compact;
  return text;
}

/**
 * The first problem with the four fields as a Mongolian message, else null.
 * Formats are checked only on values that differ from `saved`: a регистр or
 * phone that came from the ERP is what the ERP login uses, whatever its shape.
 */
export function identityProblem(
  values: Identity,
  saved?: Record<string, unknown> | null,
): string | null {
  const blank = IDENTITY_FIELDS.find(([key]) => !filled(values[key]));
  if (blank) return `«${blank[1]}» талбарыг бөглөнө үү.`;
  const regno = normalizeRegno(values.regno);
  if (regno !== normalizeRegno(saved?.regno) && !REGISTER_ID_PATTERN.test(regno)) {
    return "Регистрийн дугаар 2 кирилл үсэг, 8 цифрээс бүрдэнэ (жишээ нь УБ99010101).";
  }
  const phone = values.mobilephone.trim();
  if (normalizePhone(phone) !== normalizePhone(saved?.mobilephone) && !PHONE_PATTERN.test(phone)) {
    return "Утасны дугаараа зөв оруулна уу (жишээ нь 9911 2233).";
  }
  return null;
}
