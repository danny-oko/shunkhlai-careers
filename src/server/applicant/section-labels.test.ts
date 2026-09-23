import { describe, expect, it } from "vitest";

import { labelRow, labelSources } from "./erp-model";
import {
  type ApplicantDoc,
  type HandlerDeps,
  LANGUAGE_REQUIRED_MESSAGE,
  type Row,
  SCHOOL_REQUIRED_MESSAGE,
  handleApplicantRequest,
} from "./handlers";

/**
 * Боловсрол labels: what a save stores next to the ids, and what a pull adds
 * to the ERP's id-only rows. The university list hangs off `countryid`; live
 * (2026-09-22) `=0` is every school (1841), `=28` Монгол's (1762).
 */

const UNIVERSITIES: Record<string, Array<[number, string]>> = {
  "0": [[68, "МУИС-ГХСС"], [391, "Сайхандулаан сумын сургууль"], [500, "Алтайн их сургууль"]],
  "28": [[68, "МУИС-ГХСС"]],
  "3": [[500, "Алтайн их сургууль"]],
};

/** GetForLanguageLevelDropDown, live 2026-09-22 (part). */
const LEVELS: Record<string, string> = { "2": "Анхан", "4": "Дунд", "6": "Дээд түвшин" };

/** GetJobDropDown, live 2026-09-22 (part of 1788). */
const JOBS: Record<string, string> = {
  "7134": "Агуулахын стратеги, төсөл хариуцсан менежер",
  "8477": "Админ менежер",
};

function recordingLabel() {
  const calls: Array<[string, unknown, Row | undefined]> = [];
  const label: HandlerDeps["label"] = async (dropdown, key, parent) => {
    calls.push([dropdown, key, parent]);
    if (dropdown === "GetUniversityDropDown") {
      const rows = UNIVERSITIES[String(parent?.countryid)] ?? [];
      return rows.find(([id]) => String(id) === String(key))?.[1] ?? "";
    }
    if (dropdown === "GetProfessionDropDown") return String(key) === "2414" ? "AI Инженер" : "";
    if (dropdown === "get_educationlevel_dropdown") return String(key) === "2010" ? "Бакалавр" : "";
    if (dropdown === "GetForLanguageDropDown") return String(key) === "15" ? "Англи" : "";
    if (dropdown === "GetForLanguageLevelDropDown") return LEVELS[String(key)] ?? "";
    if (dropdown === "GetJobDropDown") return JOBS[String(key)] ?? "";
    // Live (2026-09-22) the list is this one row.
    if (dropdown === "GetBusinessTypeDropDown") return String(key) === "1" ? "Хүнс үйлдвэрлэл" : "";
    return "";
  };
  return { label, calls };
}

const universityCalls = (calls: Array<[string, unknown, Row | undefined]>) =>
  calls.filter(([dropdown]) => dropdown === "GetUniversityDropDown").map(([, key, parent]) => [key, parent]);

describe("labelRow (education)", () => {
  it("no country chosen: the university is looked up under countryid 0, never without one", async () => {
    const { label, calls } = recordingLabel();
    const row = await labelRow("education", { universityid: 68 }, label);
    expect(row.universityname).toBe("МУИС-ГХСС");
    expect(universityCalls(calls)).toEqual([[68, { countryid: 0 }]]);
  });

  it("under the saved country first, then every country for a school its list leaves out", async () => {
    const { label, calls } = recordingLabel();
    expect((await labelRow("education", { countryid: 3, universityid: 500 }, label)).universityname).toBe(
      "Алтайн их сургууль",
    );
    expect((await labelRow("education", { countryid: 28, universityid: 391 }, label)).universityname).toBe(
      "Сайхандулаан сумын сургууль",
    );
    expect(universityCalls(calls)).toEqual([
      [500, { countryid: 3 }],
      [391, { countryid: 28 }],
      [391, { countryid: 0 }],
    ]);
  });

  it("a typed school (universityid 0) has no list label and asks nothing", async () => {
    const { label, calls } = recordingLabel();
    const row = await labelRow(
      "education",
      { universityid: 0, universitynametext: "Мандах академи", universityname: "stale" },
      label,
    );
    expect(row.universityname).toBe("");
    expect(universityCalls(calls)).toEqual([]);
  });

  it("keep: fills only what is missing", async () => {
    const { label, calls } = recordingLabel();
    const row = await labelRow(
      "education",
      { universityid: 68, universityname: "ERP-ийн нэр", professionid: 2414 },
      label,
      true,
    );
    expect(row).toMatchObject({ universityname: "ERP-ийн нэр", professionname: "AI Инженер" });
    expect(row).not.toHaveProperty("educationlevelname"); // no id, nothing to add
    expect(universityCalls(calls)).toEqual([]);
  });
});

describe("labelSources", () => {
  it("labels hrappedulist and hrapplanglist in a GetHrAppEducationData bundle and leaves their siblings alone", async () => {
    const { label } = recordingLabel();
    const bundle = {
      hrappedulist: [{ entryid: 1, universityid: 68, educationlevelid: 2010 }],
      hrapplanglist: [{ entryid: 2, forlanguageid: 15, speakinglevelid: 4, writinglevelid: 0 }],
      hrappquallist: [{ entryid: 3, forlanguageid: 15 }],
    };
    const sources: Record<string, unknown> = { GetHrAppEducationData: bundle };
    await labelSources(sources, label);
    expect(bundle.hrappedulist).toEqual([
      { entryid: 1, universityid: 68, educationlevelid: 2010, universityname: "МУИС-ГХСС", educationlevelname: "Бакалавр" },
    ]);
    expect(bundle.hrapplanglist).toEqual([
      { entryid: 2, forlanguageid: 15, speakinglevelid: 4, writinglevelid: 0, forlanguagename: "Англи", speakinglevelname: "Дунд" },
    ]);
    expect(bundle.hrappquallist).toEqual([{ entryid: 3, forlanguageid: 15 }]);
  });

  it("a failing lookup leaves the row as it came", async () => {
    const sources: Record<string, unknown> = {
      GetHrAppEducationData: { hrappedulist: [{ entryid: 1, universityid: 68 }] },
    };
    await labelSources(sources, async () => {
      throw new Error("down");
    });
    expect(sources.GetHrAppEducationData).toEqual({ hrappedulist: [{ entryid: 1, universityid: 68 }] });
  });

  it("an unusable answer is left alone", async () => {
    const sources: Record<string, unknown> = { GetHrAppEducationData: null };
    await labelSources(sources, recordingLabel().label);
    expect(sources).toEqual({ GetHrAppEducationData: null });
  });
});

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

describe("SaveHrAppEducation", () => {
  let next = 100;
  const save = async (doc: ApplicantDoc, body: Row) => {
    const { label } = recordingLabel();
    return handleApplicantRequest(
      { endpoint: "SaveHrAppEducation", method: "POST", query: new URLSearchParams(), body },
      doc,
      { label, nextEntryId: () => (next += 1), jobOrder: () => null },
    );
  };

  it("needs a school: from the list, or typed", async () => {
    const doc = emptyDoc();
    for (const body of [{ entryid: 0 }, { entryid: 0, universityid: 0, universitynametext: "  " }]) {
      const result = await save(doc, body);
      expect(result?.envelope).toMatchObject({ rettype: 1, retmsg: SCHOOL_REQUIRED_MESSAGE });
      expect(result?.mutated).toBe(false);
    }
    expect(doc.education).toEqual([]);
  });

  it("a typed school is stored as universityid 0 + its name, and listed by that name", async () => {
    const doc = emptyDoc();
    const result = await save(doc, { entryid: 0, universityid: 0, universitynametext: "Мандах академи" });
    expect(result?.envelope.rettype).toBe(0);
    expect(doc.education[0]).toMatchObject({
      universityid: 0,
      universitynametext: "Мандах академи",
      universityname: "",
    });
  });

  it("a listed school is labelled; switching it to typed drops the old label", async () => {
    const doc = emptyDoc();
    await save(doc, { entryid: 0, universityid: 68 });
    expect(doc.education[0].universityname).toBe("МУИС-ГХСС");
    const entryid = doc.education[0].entryid;
    await save(doc, { entryid, universityid: 0, universitynametext: "Мандах академи" });
    expect(doc.education).toHaveLength(1);
    expect(doc.education[0]).toMatchObject({ universityname: "", universitynametext: "Мандах академи" });
  });
});

describe("labelRow (languages)", () => {
  it("names the language and each of the four levels from the one level list", async () => {
    const { label, calls } = recordingLabel();
    const row = await labelRow(
      "languages",
      { forlanguageid: 15, listeninglevelid: 2, speakinglevelid: 4, readinglevelid: 6, writinglevelid: 4 },
      label,
    );
    expect(row).toMatchObject({
      forlanguagename: "Англи",
      listeninglevelname: "Анхан",
      speakinglevelname: "Дунд",
      readinglevelname: "Дээд түвшин",
      writinglevelname: "Дунд",
    });
    expect(calls.map(([dropdown]) => dropdown)).toEqual([
      "GetForLanguageDropDown",
      ...Array(4).fill("GetForLanguageLevelDropDown"),
    ]);
  });
});

describe("SaveAppForLanguage", () => {
  let next = 200;
  const save = async (doc: ApplicantDoc, body: Row) =>
    handleApplicantRequest(
      { endpoint: "SaveAppForLanguage", method: "POST", query: new URLSearchParams(), body },
      doc,
      { label: recordingLabel().label, nextEntryId: () => (next += 1), jobOrder: () => null },
    );

  it("needs the language", async () => {
    const doc = emptyDoc();
    for (const body of [{ entryid: 0 }, { entryid: 0, forlanguageid: 0, speakinglevelid: 4 }]) {
      const result = await save(doc, body);
      expect(result?.envelope).toMatchObject({ rettype: 1, retmsg: LANGUAGE_REQUIRED_MESSAGE });
      expect(result?.mutated).toBe(false);
    }
    expect(doc.languages).toEqual([]);
  });

  it("stores studytime and every label; an edit that empties a level (0) drops its name", async () => {
    const doc = emptyDoc();
    await save(doc, { entryid: 0, forlanguageid: 15, studytime: 5, speakinglevelid: 4, score: "IELTS 6.5" });
    expect(doc.languages[0]).toMatchObject({
      forlanguagename: "Англи",
      studytime: 5,
      speakinglevelname: "Дунд",
      score: "IELTS 6.5",
    });
    const entryid = doc.languages[0].entryid;
    await save(doc, { entryid, forlanguageid: 15, studytime: 5, speakinglevelid: 0, readinglevelid: 6 });
    expect(doc.languages).toHaveLength(1);
    expect(doc.languages[0]).toMatchObject({
      speakinglevelid: 0,
      speakinglevelname: "",
      readinglevelname: "Дээд түвшин",
    });
  });
});

describe("GetHrAppEducation?entryid", () => {
  const read = (doc: ApplicantDoc, query: string) =>
    handleApplicantRequest(
      { endpoint: "GetHrAppEducation", method: "GET", query: new URLSearchParams(query), body: null },
      doc,
      { label: () => "", nextEntryId: () => 1, jobOrder: () => null },
    );

  it("answers the one row; entryid 0 or unknown answers empty", async () => {
    const doc = emptyDoc();
    doc.education = [
      { entryid: 7, universityid: 68 },
      { entryid: 8, universitynametext: "Мандах академи" },
    ];
    expect((await read(doc, "entryid=8"))?.envelope.retdata).toEqual(doc.education[1]);
    expect((await read(doc, "entryid=0"))?.envelope.retdata).toBeNull();
    expect((await read(doc, "entryid=99"))?.envelope.retdata).toBeNull();
  });
});

describe("SaveAppExperience", () => {
  let next = 300;
  const save = async (doc: ApplicantDoc, body: Row) => {
    const recorded = recordingLabel();
    const result = await handleApplicantRequest(
      { endpoint: "SaveAppExperience", method: "POST", query: new URLSearchParams(), body },
      doc,
      { label: recorded.label, nextEntryId: () => (next += 1), jobOrder: () => null },
    );
    return { result, calls: recorded.calls };
  };

  it("names the job, the business type and the head's job", async () => {
    const doc = emptyDoc();
    const { calls } = await save(doc, {
      entryid: 0,
      orgname: "Шунхлай ХХК",
      businesstypeid: 1,
      jobid: 7134,
      headjobid: 8477,
      isworking: "Y",
    });
    expect(doc.experience[0]).toMatchObject({
      jobname: "Агуулахын стратеги, төсөл хариуцсан менежер",
      businesstypename: "Хүнс үйлдвэрлэл",
      headjobname: "Админ менежер",
      isworking: "Y",
    });
    expect(calls.map(([dropdown, key]) => [dropdown, key])).toEqual([
      ["GetJobDropDown", 7134],
      ["GetBusinessTypeDropDown", 1],
      ["GetJobDropDown", 8477],
    ]);
  });

  it("a typed business type (no id) is kept as businesstypenametext, with no list label", async () => {
    const doc = emptyDoc();
    const { calls } = await save(doc, {
      entryid: 0,
      orgname: "Шунхлай ХХК",
      jobid: 7134,
      businesstypenametext: "Шатахуун түгээлт",
    });
    expect(doc.experience[0]).toMatchObject({
      businesstypenametext: "Шатахуун түгээлт",
      businesstypename: "",
      headjobname: "",
    });
    expect(calls.map(([dropdown]) => dropdown)).toEqual(["GetJobDropDown"]);
  });

  it("an edit re-labels: a head's job taken away drops its name", async () => {
    const doc = emptyDoc();
    await save(doc, { entryid: 0, orgname: "А", jobid: 7134, headjobid: 8477 });
    const entryid = doc.experience[0].entryid;
    await save(doc, { entryid, orgname: "А", jobid: 8477 });
    expect(doc.experience).toHaveLength(1);
    expect(doc.experience[0]).toMatchObject({ jobname: "Админ менежер", headjobname: "" });
    expect(doc.experience[0]).not.toHaveProperty("headjobid");
  });
});

describe("labelSources (experience)", () => {
  it("labels hrappexplist in a GetHrAppExperienceData bundle, keeping names the ERP sent", async () => {
    const bundle = {
      hrappexplist: [
        { entryid: 1, jobid: 7134, businesstypeid: 1, headjobid: 8477 },
        { entryid: 2, jobid: 8477, jobname: "ERP-ийн нэр", businesstypeid: 0 },
      ],
      hrappprojectlist: [{ entryid: 3, jobid: 7134 }],
    };
    await labelSources({ GetHrAppExperienceData: bundle }, recordingLabel().label);
    expect(bundle.hrappexplist).toEqual([
      {
        entryid: 1,
        jobid: 7134,
        businesstypeid: 1,
        headjobid: 8477,
        jobname: "Агуулахын стратеги, төсөл хариуцсан менежер",
        businesstypename: "Хүнс үйлдвэрлэл",
        headjobname: "Админ менежер",
      },
      { entryid: 2, jobid: 8477, jobname: "ERP-ийн нэр", businesstypeid: 0 },
    ]);
    expect(bundle.hrappprojectlist).toEqual([{ entryid: 3, jobid: 7134 }]);
  });
});

/* --- Гэр бүл ------------------------------------------------------------ */

/** GetRelativeDropDown / GetDivisionDropDown / GetDistrictDropDown, live 2026-09-23 (part). */
function familyLabel() {
  const calls: Array<[string, unknown, Row | undefined]> = [];
  const lists: Record<string, (key: string, parent?: Row) => string> = {
    GetRelativeDropDown: (key) => ({ "2003": "Аав", "19": "Авга ах" })[key] ?? "",
    GetCountryDropDown: (key) => ({ "28": "Монгол", "3": "Орос" })[key] ?? "",
    // Province ids are per country, district ids per province.
    GetDivisionDropDown: (key, parent) =>
      String(parent?.countryid) === "28" ? (({ "1": "Улаанбаатар" }) as Record<string, string>)[key] ?? "" : "",
    GetDistrictDropDown: (key, parent) =>
      String(parent?.divisionid) === "1" ? (({ "11": "Хан-Уул" }) as Record<string, string>)[key] ?? "" : "",
    GetProfessionDropDown: (key) => (key === "1006" ? "Өмгөөлөгч" : ""),
    GetJobDropDown: (key) => JOBS[key] ?? "",
  };
  const label: HandlerDeps["label"] = async (dropdown, key, parent) => {
    calls.push([dropdown, key, parent]);
    return lists[dropdown]?.(String(key), parent) ?? "";
  };
  return { label, calls };
}

/** The Postman SaveAppFamily row. */
const FATHER: Row = {
  entryid: 0,
  relativeid: 2003,
  lastname: "Бат",
  firstname: "Дорж",
  gender: "M",
  famregno: "УБ70010101",
  birthdate: "1970-01-01",
  countryid: 28,
  divisionid: 1,
  districtid: 11,
  professionid: 1006,
  orgname: "ААН",
  jobid: 8477,
  phone: "99330033",
  note: "",
};

describe("SaveAppFamily", () => {
  let next = 400;
  const save = async (doc: ApplicantDoc, body: unknown) => {
    const recorded = familyLabel();
    const result = await handleApplicantRequest(
      { endpoint: "SaveAppFamily", method: "POST", query: new URLSearchParams(), body },
      doc,
      { label: recorded.label, nextEntryId: () => (next += 1), jobOrder: () => null },
    );
    return { result, calls: recorded.calls };
  };

  it("stores every Postman field and names the relation, the place (each under its parent), profession and job", async () => {
    const doc = emptyDoc();
    const { calls } = await save(doc, [FATHER]);
    expect(doc.family[0]).toMatchObject({
      ...FATHER,
      entryid: expect.any(Number),
      relativename: "Аав",
      countryname: "Монгол",
      divisionname: "Улаанбаатар",
      districtname: "Хан-Уул",
      professionname: "Өмгөөлөгч",
      jobname: "Админ менежер",
    });
    expect(calls).toEqual([
      ["GetRelativeDropDown", 2003, undefined],
      ["GetCountryDropDown", 28, undefined],
      ["GetDivisionDropDown", 1, { countryid: 28 }],
      ["GetDistrictDropDown", 11, { divisionid: 1 }],
      ["GetProfessionDropDown", 1006, undefined],
      ["GetJobDropDown", 8477, undefined],
    ]);
  });

  it("ids left out ask nothing and name nothing; an edit that drops one drops its name", async () => {
    const doc = emptyDoc();
    await save(doc, [FATHER]);
    const entryid = doc.family[0].entryid;
    const { professionid: _p, jobid: _j, divisionid: _d, districtid: _t, ...rest } = FATHER;
    const { calls } = await save(doc, [{ ...rest, entryid }]);
    expect(doc.family).toHaveLength(1);
    expect(doc.family[0]).toMatchObject({
      countryname: "Монгол",
      divisionname: "",
      districtname: "",
      professionname: "",
      jobname: "",
    });
    expect(doc.family[0]).not.toHaveProperty("jobid");
    expect(calls.map(([dropdown]) => dropdown)).toEqual(["GetRelativeDropDown", "GetCountryDropDown"]);
  });
});

describe("labelSources (family)", () => {
  it("labels hrappfamilylist in a GetHrAppFamilyData bundle and leaves hrapprelativelist alone", async () => {
    const bundle = {
      hrappfamilylist: [{ entryid: 1, relativeid: 2003, countryid: 28, divisionid: 1, districtid: 11, jobid: 8477 }],
      hrapprelativelist: [{ entryid: 2, relativeid: 19 }],
    };
    await labelSources({ GetHrAppFamilyData: bundle }, familyLabel().label);
    expect(bundle.hrappfamilylist[0]).toEqual({
      entryid: 1,
      relativeid: 2003,
      countryid: 28,
      divisionid: 1,
      districtid: 11,
      jobid: 8477,
      relativename: "Аав",
      countryname: "Монгол",
      divisionname: "Улаанбаатар",
      districtname: "Хан-Уул",
      jobname: "Админ менежер",
    });
    expect(bundle.hrapprelativelist).toEqual([{ entryid: 2, relativeid: 19 }]);
  });
});
