import type { ApplicantProfile, MaritalOption, ProfileInput } from "@/lib/api/profile";

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

function read(source: Record<string, unknown>, key: string): string {
  const value = source[key];
  return value === null || value === undefined ? "" : String(value);
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
    regno: values.regno.trim().toUpperCase(),
    mobilephone: values.mobilephone.trim(),
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

/** Marked * on the old site's form; the label is what the error names. */
const REQUIRED: Array<[TextKey, string]> = [
  ["mobilephone", "Утас"],
  ["email2", "Имэйл"],
  ["countryid", "Улс"],
  ["divisionid", "Аймаг, хот"],
  ["districtid", "Сум, дүүрэг"],
  ["addr2", "Дэлгэрэнгүй хаяг"],
  ["contactname", "Холбоо барих хүний нэр"],
  ["relativeid", "Таны хэн болох"],
  ["contactphone", "Холбоо барих хүний утас"],
];

/** The first required field left empty, as a Mongolian message, else null. */
export function missingRequired(values: State): string | null {
  const missing = REQUIRED.find(([key]) => !values[key].trim());
  return missing ? `«${missing[1]}» талбарыг бөглөнө үү.` : null;
}
