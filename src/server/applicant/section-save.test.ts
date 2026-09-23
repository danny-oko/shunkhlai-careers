import { describe, expect, it } from "vitest";

import { INTEREST_DUPLICATE_MESSAGE, INTEREST_GROUP_REQUIRED_MESSAGE } from "@/lib/interested-job";

import { labelSources } from "./erp-model";
import {
  EXPERIENCE_JOB_REQUIRED_MESSAGE,
  EXPERIENCE_ORG_REQUIRED_MESSAGE,
  FAMILY_REQUIRED_MESSAGE,
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
    // getPosGroupDropdown / getPositionsDropdown as live answers them (2026-09-23): codes kept.
    if (dropdown === "getPosGroupDropdown") return String(key) === "142" ? "/16/ Инженер, техник" : "";
    if (dropdown === "getPositionsDropdown") return String(key) === "12384" ? "/02-007/ Tехник бүтээгдэхүүн хөгжүүлэлтийн менежер" : "";
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
    await post(doc, "SaveAppExperience", { entryid: 77, orgname: "Шинэ", jobid: 100 });
    expect(doc.experience).toHaveLength(2);
    expect(doc.experience[0]).toEqual({ entryid: 44, orgname: "Шунхлай", erp: "synced" });
  });

  it("a new row never takes the marker the body carries", async () => {
    const doc = emptyDoc();
    await post(doc, "SaveAppExperience", { entryid: 0, orgname: "Шинэ", jobid: 100, erp: "synced" });
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

describe("required fields the forms ask for, refused on the server too", () => {
  it("SaveAppExperience: Байгууллагын нэр and the job (a list id — there is no typed-job column)", async () => {
    const doc = emptyDoc();
    for (const [body, message] of [
      [{ entryid: 0, jobid: 100 }, EXPERIENCE_ORG_REQUIRED_MESSAGE],
      [{ entryid: 0, orgname: "  ", jobid: 100 }, EXPERIENCE_ORG_REQUIRED_MESSAGE],
      [{ entryid: 0, orgname: "Шунхлай" }, EXPERIENCE_JOB_REQUIRED_MESSAGE],
      [{ entryid: 0, orgname: "Шунхлай", jobid: 0 }, EXPERIENCE_JOB_REQUIRED_MESSAGE],
    ] as const) {
      const result = await post(doc, "SaveAppExperience", body);
      expect(result?.envelope).toMatchObject({ rettype: 1, retmsg: message });
      expect(result?.mutated).toBe(false);
    }
    expect(doc.experience).toEqual([]);
    const ok = await post(doc, "SaveAppExperience", { entryid: 0, orgname: "Шунхлай", jobid: 100 });
    expect(ok?.envelope.rettype).toBe(0);
    expect(doc.experience[0]).toMatchObject({ orgname: "Шунхлай", jobid: 100, jobname: "Нягтлан бодогч" });
  });

  it("SaveAppFamily: every row names the relation and the first name; one bad row refuses the array", async () => {
    const doc = emptyDoc();
    for (const body of [
      [{ entryid: 0, firstname: "Дорж" }],
      [{ entryid: 0, relativeid: 1, firstname: " " }],
      [{ entryid: 0, relativeid: 1, firstname: "Дорж" }, { entryid: 0, relativeid: 0, firstname: "Сараа" }],
      [],
    ]) {
      const result = await post(doc, "SaveAppFamily", body);
      expect(result?.envelope).toMatchObject({ rettype: 1, retmsg: FAMILY_REQUIRED_MESSAGE });
      expect(result?.mutated).toBe(false);
    }
    expect(doc.family).toEqual([]);
    const ok = await post(doc, "SaveAppFamily", [{ entryid: 0, relativeid: 1, firstname: "Дорж" }]);
    expect(ok?.envelope.rettype).toBe(0);
    expect(doc.family[0]).toMatchObject({ relativeid: 1, relativename: "Эх", firstname: "Дорж" });
  });
});

describe("SaveInterestedJobItem", () => {
  it("needs the group; the position may be left empty (group-only interest)", async () => {
    const doc = emptyDoc();
    for (const body of [{ entryid: 0 }, { entryid: 0, posgroupid: null, positionid: 12384 }, { entryid: 0, posgroupid: 0 }]) {
      const result = await post(doc, "SaveInterestedJobItem", body);
      expect(result?.envelope).toMatchObject({ rettype: 1, retmsg: INTEREST_GROUP_REQUIRED_MESSAGE });
      expect(result?.mutated).toBe(false);
    }
    const ok = await post(doc, "SaveInterestedJobItem", { entryid: 0, posgroupid: 142, positionid: null, depid: null });
    expect(ok?.envelope.rettype).toBe(0);
    expect(doc.interests[0]).toMatchObject({ posgroupid: 142, positionid: null, posgroupname: "/16/ Инженер, техник", positionname: "" });
  });

  it("names the group and the position; depid is stored as sent (the dropdown's text)", async () => {
    const doc = emptyDoc();
    await post(doc, "SaveInterestedJobItem", { entryid: 0, posgroupid: 142, positionid: 12384, depid: "100868" });
    expect(doc.interests[0]).toMatchObject({
      posgroupid: 142,
      positionid: 12384,
      depid: "100868",
      posgroupname: "/16/ Инженер, техник",
      positionname: "/02-007/ Tехник бүтээгдэхүүн хөгжүүлэлтийн менежер",
    });
  });

  it("the same group + position twice is refused (a pulled row counts, ids as text or numbers alike)", async () => {
    const doc = emptyDoc();
    doc.interests.push(
      { entryid: 5, posgroupid: "142", positionid: 12384, depid: "100868", erp: "synced" },
      { entryid: 6, posgroupid: 142, positionid: null, erp: "synced" },
    );
    for (const body of [
      { entryid: 0, posgroupid: 142, positionid: "12384", depid: "100868" },
      { entryid: 0, posgroupid: 142 },
      { entryid: 0, posgroupid: 142, positionid: 0 },
    ]) {
      const result = await post(doc, "SaveInterestedJobItem", body);
      expect(result?.envelope).toMatchObject({ rettype: 1, retmsg: INTEREST_DUPLICATE_MESSAGE });
      expect(result?.mutated).toBe(false);
    }
    // Moving one row onto the other's pair is the same duplicate.
    const clash = await post(doc, "SaveInterestedJobItem", { entryid: 6, posgroupid: 142, positionid: 12384 });
    expect(clash?.envelope.retmsg).toBe(INTEREST_DUPLICATE_MESSAGE);
    expect(doc.interests).toHaveLength(2);
  });

  it("an edit (entryid > 0) may keep its own pair, and replaces the row in place", async () => {
    const doc = emptyDoc();
    doc.interests.push({ entryid: 5, posgroupid: 142, positionid: null, depid: null, erp: "synced" });
    const same = await post(doc, "SaveInterestedJobItem", { entryid: 5, posgroupid: 142, positionid: null, depid: null });
    expect(same?.envelope.rettype).toBe(0);
    const moved = await post(doc, "SaveInterestedJobItem", { entryid: 5, posgroupid: 142, positionid: 12384, depid: "100868" });
    expect(moved?.envelope.rettype).toBe(0);
    expect(doc.interests).toHaveLength(1);
    expect(doc.interests[0]).toMatchObject({ entryid: 5, positionid: 12384, positionname: "/02-007/ Tехник бүтээгдэхүүн хөгжүүлэлтийн менежер" });
  });

  it("a pull labels the ERP's id-only rows (getInterestedJobsList: entryid, posgroupid, positionid, depid)", async () => {
    const { label } = recordingLabel();
    const sources: Record<string, unknown> = {
      getInterestedJobsList: [
        { entryid: 5, posgroupid: 142, positionid: 12384, depid: "100868" },
        { entryid: 6, posgroupid: 142, positionid: null, depid: null },
      ],
    };
    await labelSources(sources, label);
    expect(sources.getInterestedJobsList).toEqual([
      {
        entryid: 5,
        posgroupid: 142,
        positionid: 12384,
        depid: "100868",
        posgroupname: "/16/ Инженер, техник",
        positionname: "/02-007/ Tехник бүтээгдэхүүн хөгжүүлэлтийн менежер",
      },
      { entryid: 6, posgroupid: 142, positionid: null, depid: null, posgroupname: "/16/ Инженер, техник" },
    ]);
  });
});
