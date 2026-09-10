import { APPLICANT_BASE } from "./core/config";
import { type SectionResource, createSection } from "./core/factories";
import { apiGet, apiPost } from "./core/request";

/**
 * The CV builder's fifteen sections.
 *
 * Every one of them is the same resource — optional tab bundle, read one,
 * save (entryid 0 = new), delete — so they are declared as data. Adding a
 * section is one entry here, not a new file.
 *
 *   sections.education.tabData()          → GetHrAppEducationData
 *   sections.education.get(123)           → GetHrAppEducation?entryid=123
 *   sections.education.save({ entryid: 0, … })
 *   sections.education.remove(entry)
 *
 * Endpoints marked "one or more entries at once" in the reference accept an
 * array in `save`.
 */

const p = (name: string) => `${APPLICANT_BASE}/${name}`;

export const education = createSection({
  tabData: p("GetHrAppEducationData"),
  get: p("GetHrAppEducation"),
  save: p("SaveHrAppEducation"),
  remove: p("DeleteHrAppEducation"),
});

export const foreignLanguage = createSection({
  get: p("GetAppForLanguage"),
  save: p("SaveAppForLanguage"),
  remove: p("DeleteAppForLanguage"),
});

/** Batch save. */
export const computerSkill = createSection({
  get: p("GetAppSkillComp"),
  save: p("SaveAppSkillComp"),
  remove: p("DeleteAppSkillComp"),
});

/** Batch save. */
export const qualification = createSection({
  get: p("GetAppQualification"),
  save: p("SaveAppQualification"),
  remove: p("DeleteAppQualification"),
});

export const training = createSection({
  save: p("SaveHrAppTraining"),
  remove: p("DeleteHrAppTraining"),
});

export const certificate = createSection({
  save: p("SaveHrAppCertificate"),
  remove: p("DeleteHrAppCertificate"),
});

/** Batch save. Shares the Family tab bundle with `relative`. */
export const family = createSection({
  tabData: p("GetHrAppFamilyData"),
  get: p("GetAppFamily"),
  save: p("SaveAppFamily"),
  remove: p("DeleteAppFamily"),
});

/** Batch save. */
export const relative = createSection({
  tabData: p("GetHrAppFamilyData"),
  get: p("GetAppRelative"),
  save: p("SaveAppRelative"),
  remove: p("DeleteAppRelative"),
});

/** Batch save. The only section with its own list endpoint. */
export const reference = createSection({
  list: p("GetAppReferenceList"),
  get: p("GetAppReference"),
  save: p("SaveAppReference"),
  remove: p("DeleteAppReference"),
});

export const experience = createSection({
  tabData: p("GetHrAppExperienceData"),
  get: p("GetAppExperience"),
  save: p("SaveAppExperience"),
  remove: p("DeleteAppExperience"),
});

export const project = createSection({
  get: p("GetAppProject"),
  save: p("SaveAppProject"),
  remove: p("DeleteAppProject"),
});

export const internship = createSection({
  get: p("GetAppInternship"),
  save: p("SaveAppInternship"),
  remove: p("DeleteAppInternship"),
});

/** Shares the "Personal characteristics" tab bundle with `ability`. */
export const award = createSection({
  tabData: p("GetHrAppSpecialityData"),
  get: p("GetAppAward"),
  save: p("SaveAppAward"),
  remove: p("DeleteAppAward"),
});

export const ability = createSection({
  tabData: p("GetHrAppSpecialityData"),
  get: p("GetAppAbility"),
  save: p("SaveAppAbility"),
  remove: p("DeleteAppAbility"),
});

/**
 * Interests are a single free-text record rather than a list, so they get
 * plain functions instead of the section shape.
 */
export const interest = {
  get: <T = unknown>() => apiGet<T>(p("GetAppInterest")),
  save: (body: { interest?: string; [key: string]: unknown }) =>
    apiPost<unknown>(p("SaveAppInterest"), body),
};

/** Every list-shaped section, for iterating (e.g. a completeness indicator). */
export const cvSections = {
  education,
  foreignLanguage,
  computerSkill,
  qualification,
  training,
  certificate,
  family,
  relative,
  reference,
  experience,
  project,
  internship,
  award,
  ability,
} satisfies Record<string, SectionResource>;

export type CvSectionName = keyof typeof cvSections;
