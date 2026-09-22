import { describe, expect, it } from "vitest";

import { labelRow, labelSources } from "./erp-model";
import {
  type ApplicantDoc,
  type HandlerDeps,
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
  it("labels hrappedulist in a GetHrAppEducationData bundle and leaves its siblings alone", async () => {
    const { label } = recordingLabel();
    const bundle = {
      hrappedulist: [{ entryid: 1, universityid: 68, educationlevelid: 2010 }],
      hrapplanglist: [{ entryid: 2, forlanguageid: 1 }],
    };
    const sources: Record<string, unknown> = { GetHrAppEducationData: bundle };
    await labelSources(sources, label);
    expect(bundle.hrappedulist).toEqual([
      { entryid: 1, universityid: 68, educationlevelid: 2010, universityname: "МУИС-ГХСС", educationlevelname: "Бакалавр" },
    ]);
    expect(bundle.hrapplanglist).toEqual([{ entryid: 2, forlanguageid: 1 }]);
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
