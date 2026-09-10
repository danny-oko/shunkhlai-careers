import { APPLICANT_BASE } from "./core/config";
import { createDropdown } from "./core/factories";
import { apiGet, apiGetList } from "./core/request";

/**
 * Reference data — the dropdown lists behind every form in the CV builder.
 *
 * All of these are public (`Auth: not required`) and change rarely, which
 * makes them the natural first candidates for caching if the app later opts
 * into `cacheComponents`. Each takes `{ search, lfr, ids }`; the ones with a
 * parent take one more id, spelled here exactly as the backend expects it.
 */

const p = (name: string) => `${APPLICANT_BASE}/${name}`;

export const countries = createDropdown(p("GetCountryDropDown"));
export const divisions = createDropdown<{ countryid: number }>(p("GetDivisionDropDown"));
export const districts = createDropdown<{ divisionid: number }>(p("GetDistrictDropDown"));
export const universities = createDropdown<{ countryid: number }>(p("GetUniversityDropDown"));
export const professions = createDropdown(p("GetProfessionDropDown"));
export const educationLevels = createDropdown(p("get_educationlevel_dropdown"));
export const foreignLanguages = createDropdown(p("GetForLanguageDropDown"));
export const foreignLanguageLevels = createDropdown(p("GetForLanguageLevelDropDown"));
export const computerSkills = createDropdown(p("GetSkillCompDropDown"));
export const computerSkillLevels = createDropdown<{ skillcompid: number }>(
  p("GetSkillCompLevelDropDown"),
);
export const relativeTypes = createDropdown(p("GetRelativeDropDown"));
export const jobTitles = createDropdown(p("GetJobDropDown"));
export const businessTypes = createDropdown(p("GetBusinessTypeDropDown"));
export const awardTypes = createDropdown(p("GetAwardTypeDropDown"));
/** `type` selects the category — sport vs. art. */
export const abilities = createDropdown<{ type: number }>(p("GetAbilityDropDown"));

/* The three below take `search` only — no `lfr` / `ids`. */
export const sources = createDropdown(p("GetSourceDropDown"));
export const positionGroups = createDropdown(p("getPosGroupDropdown"));
export const positions = createDropdown(p("getPositionsDropdown"));

/** GET /api/applicant/getSiProfession — profession list from the external "SI" source. */
export function siProfessions<T = unknown>() {
  return apiGetList<T>(p("getSiProfession"), undefined, { skipAuth: true });
}

/** GET /api/applicant/getCountryID — this tenant's default country. */
export function defaultCountryId<T = unknown>() {
  return apiGet<T>(p("getCountryID"), undefined, { skipAuth: true });
}
