import { ME_BASE } from "./core/config";
import { type SectionEntry, createSection } from "./core/factories";

/**
 * The CV sections.
 *
 * Three bundle endpoints return every list the CV needs:
 *
 *   GetHrAppEducationData  → hrappedulist · hrapplanglist · hrappquallist · hrappcomplist
 *   GetHrAppExperienceData → hrappexplist · hrappprojectlist · hrappinternlist
 *   GetHrAppFamilyData     → hrappfamilylist · hrapprelativelist
 *
 * Each section below points at its bundle and names its list, so a screen can
 * either read one section or take the whole bundle in a single call.
 */

const p = (name: string) => `${ME_BASE}/${name}`;

const EDUCATION_BUNDLE = p("GetHrAppEducationData");
const EXPERIENCE_BUNDLE = p("GetHrAppExperienceData");
const FAMILY_BUNDLE = p("GetHrAppFamilyData");

export type EducationEntry = SectionEntry & {
  entryid: number;
  countryid?: number;
  divisionid?: number;
  universityid?: number;
  universitynametext?: string;
  universityname?: string;
  professionid?: number;
  professionname?: string;
  educationlevelid?: number;
  educationlevelname?: string;
  fromdate?: string;
  todate?: string;
  /**
   * Derived by the server from `todate`, and INVERTED relative to its meaning:
   * the real backend returns `Үгүй` when `todate` is SET and `Тийм` when it is
   * EMPTY. Do not display this; the UI derives the label from `todate` itself.
   * `isgraduated` is ignored.
   */
  graduated?: string;
  gpa?: number;
  gpapercent?: number;
  score?: string;
  certificateno?: string;
  thesis?: string;
  note?: string;
};

export type LanguageEntry = SectionEntry & {
  entryid: number;
  forlanguageid?: number;
  forlanguagename?: string;
  listeninglevelid?: number;
  speakinglevelid?: number;
  readinglevelid?: number;
  writinglevelid?: number;
  score?: string;
};

export type ComputerSkillEntry = SectionEntry & {
  entryid: number;
  skillcompid?: number;
  skillcompname?: string;
  levelid?: number;
  levelname?: string;
  compnametext?: string;
  note?: string;
};

export type ExperienceEntry = SectionEntry & {
  entryid: number;
  orgname?: string;
  businesstypeid?: number;
  businesstypename?: string;
  jobid?: number;
  jobname?: string;
  fromdate?: string;
  todate?: string;
  /** Derived by the server from `todate`; `isworking` is ignored. */
  working?: string;
  basewage?: number;
  responsibility?: string;
  reason?: string;
  headname?: string;
  headjobid?: number;
  headphone?: string;
};

export type FamilyEntry = SectionEntry & {
  entryid: number;
  relativeid?: number;
  relativename?: string;
  lastname?: string;
  firstname?: string;
  gender?: "M" | "F";
  famregno?: string;
  birthdate?: string;
  countryid?: number;
  divisionid?: number;
  districtid?: number;
  professionid?: number | null;
  orgname?: string;
  jobid?: number | null;
  phone?: string;
  note?: string;
};

/** Delete takes `ENTRYID` in capitals here — the only endpoint that does. */
export const education = createSection<EducationEntry>({
  bundle: EDUCATION_BUNDLE,
  listKey: "hrappedulist",
  get: p("GetHrAppEducation"),
  save: p("SaveHrAppEducation"),
  remove: p("DeleteHrAppEducation"),
  removeParam: "ENTRYID",
});

export const language = createSection<LanguageEntry>({
  bundle: EDUCATION_BUNDLE,
  listKey: "hrapplanglist",
  get: p("GetAppForLanguage"),
  save: p("SaveAppForLanguage"),
  remove: p("DeleteAppForLanguage"),
});

/** Saved as an array — the endpoint takes every row at once. */
export const computerSkill = createSection<ComputerSkillEntry>({
  bundle: EDUCATION_BUNDLE,
  listKey: "hrappcomplist",
  get: p("GetAppSkillComp"),
  save: p("SaveAppSkillComp"),
  remove: p("DeleteAppSkillComp"),
  batch: true,
});

export const experience = createSection<ExperienceEntry>({
  bundle: EXPERIENCE_BUNDLE,
  listKey: "hrappexplist",
  get: p("GetAppExperience"),
  save: p("SaveAppExperience"),
  remove: p("DeleteAppExperience"),
});

/** Saved as an array. */
export const family = createSection<FamilyEntry>({
  bundle: FAMILY_BUNDLE,
  listKey: "hrappfamilylist",
  get: p("GetAppFamily"),
  save: p("SaveAppFamily"),
  remove: p("DeleteAppFamily"),
  batch: true,
});

/**
 * Read-only for now: these lists arrive inside the bundles above, but the
 * collection carries no save/delete endpoints for them. The endpoint
 * reference does (`SaveAppQualification`, `SaveAppProject`, …) — add them here
 * when the backend team confirms they are live.
 */
export const readOnlyLists = {
  qualification: { bundle: EDUCATION_BUNDLE, listKey: "hrappquallist" },
  project: { bundle: EXPERIENCE_BUNDLE, listKey: "hrappprojectlist" },
  internship: { bundle: EXPERIENCE_BUNDLE, listKey: "hrappinternlist" },
  relative: { bundle: FAMILY_BUNDLE, listKey: "hrapprelativelist" },
} as const;

export const cvSections = { education, language, computerSkill, experience, family };
export type CvSectionName = keyof typeof cvSections;
