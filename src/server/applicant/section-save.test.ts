import { describe, expect, it } from "vitest";

import {
  type ApplicantDoc,
  type HandlerDeps,
  type Row,
  SKILL_REQUIRED_MESSAGE,
  handleApplicantRequest,
} from "./handlers";

/**
 * A section edit through `/api/me` (and the dev mock): the body is the row now.
 * The form leaves an emptied optional numeric out of it (never `null`; see
 * `section-payload.ts`), so a key the body lacks is a cleared one — the stored
 * row must not keep it, or the flush sends the old value back to the ERP.
 */

/** GetSkillCompDropDown / GetSkillCompLevelDropDown as live answers them (2026-09-22). */
const SKILLS: Record<string, string> = { "3": "Word", "6": "Excel", "11": "Autocad" };
const SKILL_LEVELS: Record<string, string> = { "2": "Бүрэн эзэмшсэн", "4": "Анхан шатны", "3": "Хэрэглээний түвшинд" };

function recordingLabel() {
  const calls: Array<[string, unknown, Row | undefined]> = [];
  const label: HandlerDeps["label"] = async (dropdown, key, parent) => {
    calls.push([dropdown, key, parent]);
    if (dropdown === "GetSkillCompDropDown") return SKILLS[String(key)] ?? "";
    if (dropdown === "GetSkillCompLevelDropDown") return SKILL_LEVELS[String(key)] ?? "";
    if (dropdown === "GetUniversityDropDown") return String(key) === "68" ? "МУИС-ГХСС" : "";
    if (dropdown === "get_educationlevel_dropdown") return String(key) === "2010" ? "Бакалавр" : "";
    if (dropdown === "GetForLanguageDropDown") return String(key) === "15" ? "Англи" : "";
    if (dropdown === "GetJobDropDown") return String(key) === "100" ? "Нягтлан бодогч" : "";
    if (dropdown === "GetRelativeDropDown") return String(key) === "1" ? "Эх" : "";
    if (dropdown === "getPosGroupDropdown") return String(key) === "142" ? "Инженер" : "";
    return "";
  };
  return { label, calls };
}

function emptyDoc(): ApplicantDoc {
  return {
    profile: {},
    education: [],
    languages: [],
    qualifications: [],
    skills: [],
    experience: [],
    projects: [],
    internships: [],
    family: [],
    relatives: [],
    interests: [],
    applications: [],
    picture: null,
    cv: null,
  } as unknown as ApplicantDoc;
}

let next = 1_000_000_000;
async function post(doc: ApplicantDoc, endpoint: string, body: unknown, label = recordingLabel().label) {
  return handleApplicantRequest(
    { endpoint, method: "POST", query: new URLSearchParams(), body },
    doc,
    { label, nextEntryId: () => (next += 1), jobOrder: () => null },
  );
}

/** Every section save: the stored row (as the list echoes it back) and the edit that empties one key. */
const CASES: Array<{
  section: keyof ApplicantDoc;
  endpoint: string;
  batch?: boolean;
  stored: Row;
  cleared: string;
}> = [
  {
    section: "education",
    endpoint: "SaveHrAppEducation",
    stored: { entryid: 41, countryid: 28, divisionid: 1, universityid: 68, educationlevelid: 2010, gpa: 3.6 },
    cleared: "divisionid",
  },
  {
    section: "languages",
    endpoint: "SaveAppForLanguage",
    stored: { entryid: 42, forlanguageid: 15, studytime: 5, speakinglevelid: 4 },
    cleared: "studytime",
  },
  {
    section: "skills",
    endpoint: "SaveAppSkillComp",
    batch: true,
    stored: { entryid: 43, skillcompid: 6, levelid: 2, note: "Pivot" },
    cleared: "note",
  },
  {
    section: "experience",
    endpoint: "SaveAppExperience",
    stored: { entryid: 44, orgname: "Шунхлай", jobid: 100, basewage: 2_500_000, headjobid: 7 },
    cleared: "basewage",
  },
  {
    section: "family",
    endpoint: "SaveAppFamily",
    batch: true,
    stored: { entryid: 45, relativeid: 1, firstname: "Сараа", phone: "99001122" },
    cleared: "phone",
  },
  {
    section: "interests",
    endpoint: "SaveInterestedJobItem",
    stored: { entryid: 46, posgroupid: 142, positionid: 9, depid: "3" },
    cleared: "positionid",
  },
];

describe("a section edit replaces the stored row (omitted = cleared)", () => {
  for (const c of CASES) {
    it(`${c.endpoint}: a key the edit leaves out (${c.cleared}) is gone; entryid, erp marker and labels hold`, async () => {
      const doc = emptyDoc();
      (doc[c.section] as Row[]).push({ ...c.stored, erp: "synced" }, { entryid: 99, erp: "synced", note: "other" });
      const { [c.cleared]: _gone, ...edit } = c.stored;
      // The form echoes the row it opened with, marker included.
      const body = { ...edit, erp: "synced" };
      const result = await post(doc, c.endpoint, c.batch ? [body] : body);
      expect(result?.envelope.rettype).toBe(0);

      const rows = doc[c.section] as Row[];
      expect(rows).toHaveLength(2);
      const row = rows.find((r) => r.entryid === c.stored.entryid)!;
      expect(row).not.toHaveProperty(c.cleared);
      expect(row).toMatchObject({ ...edit, entryid: c.stored.entryid, erp: "synced" });
      // The other row is untouched.
      expect(rows.find((r) => r.entryid === 99)).toEqual({ entryid: 99, erp: "synced", note: "other" });
    });
  }

  it("a stale label the edit still carries is recomputed from the new ids", async () => {
    const doc = emptyDoc();
    doc.skills.push({ entryid: 43, skillcompid: 6, skillcompname: "Excel", levelid: 2, levelname: "Бүрэн эзэмшсэн", erp: "synced" });
    await post(doc, "SaveAppSkillComp", [
      { entryid: 43, skillcompid: 11, skillcompname: "Excel", levelid: 4, levelname: "Бүрэн эзэмшсэн" },
    ]);
    expect(doc.skills[0]).toMatchObject({ skillcompid: 11, skillcompname: "Autocad", levelid: 4, levelname: "Анхан шатны" });
  });

  it("an unknown entryid inserts a new row rather than touching another", async () => {
    const doc = emptyDoc();
    doc.experience.push({ entryid: 44, orgname: "Шунхлай", erp: "synced" });
    await post(doc, "SaveAppExperience", { entryid: 77, orgname: "Шинэ" });
    expect(doc.experience).toHaveLength(2);
    expect(doc.experience[0]).toEqual({ entryid: 44, orgname: "Шунхлай", erp: "synced" });
  });

  it("a new row never takes the marker the body carries", async () => {
    const doc = emptyDoc();
    await post(doc, "SaveAppExperience", { entryid: 0, orgname: "Шинэ", erp: "synced" });
    expect(doc.experience[0]).not.toHaveProperty("erp");
  });
});

describe("SaveAppSkillComp", () => {
  it("a listed program: skillcompname and levelname, the level looked up under its skill", async () => {
    const doc = emptyDoc();
    const { label, calls } = recordingLabel();
    const result = await post(doc, "SaveAppSkillComp", [{ entryid: 0, skillcompid: 6, levelid: 2, compnametext: "", note: "" }], label);
    expect(result?.envelope.rettype).toBe(0);
    expect(doc.skills[0]).toMatchObject({ skillcompid: 6, skillcompname: "Excel", levelid: 2, levelname: "Бүрэн эзэмшсэн" });
    expect(calls.filter(([d]) => d === "GetSkillCompLevelDropDown")).toEqual([
      ["GetSkillCompLevelDropDown", 2, { skillcompid: 6 }],
    ]);
  });

  it("a program the list lacks: skillcompid 0 + compnametext, its level still named (under skillcompid 0)", async () => {
    const doc = emptyDoc();
    const { label, calls } = recordingLabel();
    await post(doc, "SaveAppSkillComp", [{ entryid: 0, skillcompid: 0, levelid: 3, compnametext: "Figma" }], label);
    expect(doc.skills[0]).toMatchObject({
      skillcompid: 0,
      compnametext: "Figma",
      skillcompname: "",
      levelname: "Хэрэглээний түвшинд",
    });
    expect(calls.map(([d]) => d)).not.toContain("GetSkillCompDropDown");
    expect(calls).toContainEqual(["GetSkillCompLevelDropDown", 3, { skillcompid: 0 }]);
  });

  it("neither a listed program nor a typed name: refused, nothing stored", async () => {
    const doc = emptyDoc();
    for (const body of [[{ entryid: 0, levelid: 2 }], [{ entryid: 0, skillcompid: 0, compnametext: "  " }], []]) {
      const result = await post(doc, "SaveAppSkillComp", body);
      expect(result?.envelope).toMatchObject({ rettype: 1, retmsg: SKILL_REQUIRED_MESSAGE });
      expect(result?.mutated).toBe(false);
    }
    // One bad row refuses the whole array: no half-saved batch.
    const mixed = await post(doc, "SaveAppSkillComp", [{ entryid: 0, skillcompid: 6 }, { entryid: 0 }]);
    expect(mixed?.envelope.rettype).toBe(1);
    expect(doc.skills).toEqual([]);
  });

  it("a listed program picked after a typed one drops the typed name's role: the list label wins", async () => {
    const doc = emptyDoc();
    await post(doc, "SaveAppSkillComp", [{ entryid: 0, skillcompid: 0, compnametext: "Figma", levelid: 2 }]);
    const entryid = doc.skills[0].entryid;
    await post(doc, "SaveAppSkillComp", [{ entryid, skillcompid: 3, compnametext: "", levelid: 2 }]);
    expect(doc.skills).toHaveLength(1);
    expect(doc.skills[0]).toMatchObject({ skillcompid: 3, skillcompname: "Word", compnametext: "" });
  });
});
