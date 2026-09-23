import type { ApplicantProfile, MaritalOption, ProfileInput } from "@/lib/api/profile";
import { identityProblem, normalizePhone, normalizeRegno } from "@/lib/applicant-identity";

/** Form values are strings (what inputs hold); licence flags are booleans. */
const TEXT_KEYS = [
  "lastname",
  "firstname",
  "regno",
  "mobilephone",
  "email2",
  "addr2",
  "maritalstatus",
  "countryid",
  "divisionid",
  "districtid",
  "contactname",
  "relativeid",
  "contactphone",
  "contactname2",
  "relativeid2",
  "contactphone2",
  "custom1",
  "custom2",
] as const;

export const LICENCE_KEYS = ["isa", "isb", "isc", "isd", "ise"] as const;

export type TextKey = (typeof TEXT_KEYS)[number];
export type LicenceKey = (typeof LICENCE_KEYS)[number];
export type State = Record<TextKey, string> & Record<LicenceKey, boolean>;

/** Parent → children; changing a parent clears everything below it. */
export const CASCADE = {
  countryid: ["divisionid"],
  divisionid: ["districtid"],
};

/**
 * What the real service returns in `maritalstatus[]`. Used only when the
 * record came without that list (the mock, or an older response).
 */
const FALLBACK_MARITAL: MaritalOption[] = [
  { key: "M", text: "Гэрлэсэн" },
  { key: "U", text: "Гэрлээгүй" },
  { key: "W", text: "Бэлэвсэн" },
  { key: "K", text: "Тодорхойгүй" },
];

export function maritalOptions(list?: MaritalOption[]): MaritalOption[] {
  return list?.length ? list : FALLBACK_MARITAL;
}

export type Choice = { value: string; label: string };

/**
 * `options` plus the saved value when the list lacks it, so a saved choice is
 * shown rather than a blank "- Сонгох -" (a code the ERP list does not carry,
 * a list still loading or failed). Only the value as loaded — once the
 * applicant picks another one, or a parent change empties it, the extra goes.
 */
export function withSavedChoice(
  options: Choice[],
  value: string,
  saved: { value: unknown; label?: unknown },
): Choice[] {
  if (!value || value !== asText(saved.value)) return options;
  if (options.some((option) => option.value === value)) return options;
  return [...options, { value, label: asText(saved.label).trim() || value }];
}

/**
 * Гэрлэлтийн байдал choices: the ERP's `maritalstatus[]` when the record came
 * with it, else the fallback list; a stored code in neither still shows (by
 * the fallback's text when it has one, else as the code itself).
 */
export function maritalChoices(profile: ApplicantProfile | null | undefined, value: string): Choice[] {
  const options = maritalOptions(profile?.maritalOptions).map((m) => ({ value: m.key, label: m.text }));
  const known = FALLBACK_MARITAL.find((m) => m.key === profile?.maritalstatus)?.text;
  return withSavedChoice(options, value, { value: profile?.maritalstatus, label: known });
}

const asText = (value: unknown) => (value === null || value === undefined ? "" : String(value));

function read(source: Record<string, unknown>, key: string): string {
  return asText(source[key]);
}

export function toState(profile: ApplicantProfile | null): State {
  const source: Record<string, unknown> = { ...profile };
  const text = TEXT_KEYS.map((key) => [key, read(source, key)]);
  const flags = LICENCE_KEYS.map((key) => [key, source[key] === true]);
  return Object.fromEntries([...text, ...flags]) as State;
}

const toId = (value: string) => (value ? Number(value) : null);

export function toInput(values: State): ProfileInput {
  return {
    ...values,
    lastname: values.lastname.trim(),
    firstname: values.firstname.trim(),
    regno: normalizeRegno(values.regno),
    mobilephone: normalizePhone(values.mobilephone),
    maritalstatus: values.maritalstatus || undefined,
    email2: values.email2.trim(),
    addr2: values.addr2.trim(),
    countryid: toId(values.countryid),
    divisionid: toId(values.divisionid),
    districtid: toId(values.districtid),
    relativeid: toId(values.relativeid),
    relativeid2: toId(values.relativeid2),
    contactname: values.contactname.trim(),
    contactphone: values.contactphone.trim(),
    contactname2: values.contactname2.trim(),
    contactphone2: values.contactphone2.trim(),
  };
}

/**
 * Marked * on the old site's form; the label is what the error names.
 * регистр, овог, нэр, утас come first and are checked by `identityProblem`
 * (shared with the /api/me gate), formats included.
 */
const REQUIRED: Array<[TextKey, string]> = [
  ["email2", "Имэйл"],
  ["countryid", "Улс"],
  ["divisionid", "Аймаг, хот"],
  ["districtid", "Сум, дүүрэг"],
  ["addr2", "Дэлгэрэнгүй хаяг"],
  ["contactname", "Холбоо барих хүний нэр"],
  ["relativeid", "Таны хэн болох"],
  ["contactphone", "Холбоо барих хүний утас"],
];

/**
 * The first problem with the form as a Mongolian message, else null. `saved`
 * is the loaded profile: an unchanged регистр/утас is not format-checked.
 */
export function missingRequired(values: State, saved?: ApplicantProfile | null): string | null {
  const identity = identityProblem(values, saved);
  if (identity) return identity;
  const missing = REQUIRED.find(([key]) => !values[key].trim());
  return missing ? `«${missing[1]}» талбарыг бөглөнө үү.` : null;
}
