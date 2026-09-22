import { describe, expect, it } from "vitest";

import { LOCAL_ID_BASE, SECTIONS, type SectionKey, planAdoption, saveBody, unadoptedOf } from "./erp-model";
import type { ApplicantDoc, Row } from "./handlers";

/**
 * Content adoption against rows the ERP reads back in its own way: a flag it
 * derives from `todate` (`isgraduated` / `isworking`) and a column it does
 * not keep yet (`businesstypenametext`) must not stop a saved row from being
 * recognised — else it stays local and goes to the ERP again as a new row.
 */

const LOCAL = LOCAL_ID_BASE + 5;

function docWith(key: SectionKey, row: Row): ApplicantDoc {
  return {
    [key]: [{ ...row, entryid: LOCAL, erp: "synced" }],
    erp: { unadopted: { [key]: [unadoptedOf({ ...row, entryid: LOCAL })] } },
  } as unknown as ApplicantDoc;
}

const config = (key: SectionKey) => SECTIONS.find((section) => section.key === key)!;

describe("planAdoption: fields the ERP derives or drops", () => {
  it("experience: isworking and businesstypenametext not read back as sent — still adopted", () => {
    const saved = {
      orgname: "Шунхлай ХХК",
      jobid: 7134,
      fromdate: "2021-03-01",
      todate: "",
      isworking: "Y",
      businesstypenametext: "Шатахуун түгээлт",
      headphone: "99112233",
    };
    const erpRow = {
      entryid: 41,
      orgname: "Шунхлай ХХК",
      jobid: 7134,
      businesstypeid: 0,
      fromdate: "2021-03-01T00:00:00",
      todate: null,
      isworking: "N",
      working: "Тийм",
      headphone: "99112233",
    };
    const adoption = planAdoption(docWith("experience", saved), config("experience"), [erpRow]);
    expect(adoption?.renamed).toEqual(new Map([[LOCAL, 41]]));
  });

  it("experience: a field the ERP does keep still has to match", () => {
    const saved = { orgname: "Шунхлай ХХК", jobid: 7134, isworking: "Y" };
    const erpRow = { entryid: 41, orgname: "Шунхлай ХХК", jobid: 100, isworking: "Y" };
    const adoption = planAdoption(docWith("experience", saved), config("experience"), [erpRow]);
    expect(adoption?.renamed.size).toBe(0);
  });

  it("education: isgraduated the ERP derived differently — still adopted", () => {
    const saved = { universityid: 68, educationlevelid: 2010, todate: "2022-06-01", isgraduated: "Y" };
    const erpRow = { entryid: 12, universityid: 68, educationlevelid: 2010, todate: "2022-06-01", graduated: "Үгүй" };
    const adoption = planAdoption(docWith("education", saved), config("education"), [erpRow]);
    expect(adoption?.renamed).toEqual(new Map([[LOCAL, 12]]));
  });

  it("the ignore list is per section: languages still compare every field", () => {
    const saved = { forlanguageid: 15, isworking: "Y" };
    const erpRow = { entryid: 3, forlanguageid: 15 };
    const adoption = planAdoption(docWith("languages", saved), config("languages"), [erpRow]);
    expect(adoption?.renamed.size).toBe(0);
  });
});

describe("saveBody (experience)", () => {
  it("our three labels stay here; the typed business type and isworking go to the ERP", () => {
    const body = saveBody({
      entryid: 41,
      jobid: 7134,
      jobname: "Агуулахын стратеги, төсөл хариуцсан менежер",
      businesstypename: "",
      businesstypenametext: "Шатахуун түгээлт",
      headjobid: 8477,
      headjobname: "Админ менежер",
      isworking: "Y",
      erp: "pending",
    });
    expect(body).toEqual({
      entryid: 41,
      jobid: 7134,
      businesstypenametext: "Шатахуун түгээлт",
      headjobid: 8477,
      isworking: "Y",
    });
  });
});

describe("family: saveBody and adoption", () => {
  const FATHER: Row = {
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
  const LABELS: Row = {
    relativename: "Аав",
    countryname: "Монгол",
    divisionname: "Улаанбаатар",
    districtname: "Хан-Уул",
    professionname: "Өмгөөлөгч",
    jobname: "Админ менежер",
  };

  it("the six labels stay here; every Postman field goes", () => {
    expect(saveBody({ ...FATHER, ...LABELS, entryid: 31, erp: "pending" })).toEqual({ ...FATHER, entryid: 31 });
  });

  it("adopted by content: the ERP reads the birthdate back as a datetime and the phone as a number", () => {
    const erpRow = { ...FATHER, entryid: 901, birthdate: "1970-01-01T00:00:00", phone: 99330033, createdby: 42 };
    const adoption = planAdoption(docWith("family", { ...FATHER, ...LABELS }), config("family"), [erpRow]);
    expect(adoption?.renamed.get(LOCAL)).toBe(901);
  });

  it("nothing is ignored: a field read back differently is not our row", () => {
    const erpRow = { ...FATHER, entryid: 901, districtid: 4 };
    const adoption = planAdoption(docWith("family", FATHER), config("family"), [erpRow]);
    expect(adoption?.renamed.size).toBe(0);
  });
});
