import { APPLICANT_BASE } from "./core/config";
import { createDropdown } from "./core/factories";
import { apiGetList } from "./core/request";

/**
 * Reference data — every dropdown the forms need. All public, all `{ key, text }`.
 * Save the `key`.
 */

const p = (name: string) => `${APPLICANT_BASE}/${name}`;

export const countries = createDropdown(p("GetCountryDropDown"));
export const divisions = createDropdown<{ countryid: number }>(p("GetDivisionDropDown"));
export const districts = createDropdown<{ divisionid: number }>(p("GetDistrictDropDown"));
export const relativeTypes = createDropdown(p("GetRelativeDropDown"));

/** `countryid: 0` returns universities from every country. */
export const universities = createDropdown<{ countryid: number }>(p("GetUniversityDropDown"));
export const professions = createDropdown(p("GetProfessionDropDown"));
export const educationLevels = createDropdown(p("get_educationlevel_dropdown"));

export const foreignLanguages = createDropdown(p("GetForLanguageDropDown"));
/** One list drives all four skills — listening, speaking, reading, writing. */
export const languageLevels = createDropdown(p("GetForLanguageLevelDropDown"));

export const computerSkills = createDropdown(p("GetSkillCompDropDown"));
export const computerSkillLevels = createDropdown<{ skillcompid: number }>(
  p("GetSkillCompLevelDropDown"),
);

export const jobTitles = createDropdown(p("GetJobDropDown"));
/** Backs the careers-page "Албан тушаалын бүлэг" filter — `ids: 1` selects the group list. */
export const jobGroups = createDropdown(p("GetJobDropDown"));
export const businessTypes = createDropdown(p("GetBusinessTypeDropDown"));

/* These three take `search` only — no `lfr` / `ids`. */
export const positionGroups = createDropdown(p("getPosGroupDropdown"), { standard: false });
/** Rows carry `posgroupid` and `depid` in `raw`, so they can be filtered by group. */
export const positions = createDropdown(p("getPositionsDropdown"), { standard: false });
/** "Where did you hear about us" — feeds `recsourceid` on an application. */
export const sources = createDropdown(p("GetSourceDropDown"), { standard: false });

export type DefaultCountry = { countryid: number; countryname: string };

/** The tenant's home country, used to pre-filter the city/province list. */
export async function defaultCountry(): Promise<DefaultCountry | null> {
  const rows = await apiGetList<DefaultCountry>(p("getCountryID"), undefined, { skipAuth: true });
  return rows[0] ?? null;
}
