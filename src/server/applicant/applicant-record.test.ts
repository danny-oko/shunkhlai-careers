import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { TestDatabase } from "@/lib/db/testing";

/**
 * The applicant's анкет as the admin desk reads it.
 *
 * This is the one read on the site that hands somebody their own data about
 * another person, so the tests are about two things and in this order:
 *
 * 1. **it is complete.** HR opens this to decide whether to call a candidate.
 *    A field the applicant filled in and this module quietly drops is a worse
 *    failure than an ugly one, so the assertions walk every section — including
 *    the four the ERP pulls in that this site has never had a form for.
 * 2. **it carries only what the applicant wrote.** The document also holds the
 *    sync's own bookkeeping and, in `erp.withdrawRefused`, a raw ERP `retmsg`
 *    that has been seen echoing an applicant's регистр back at the caller.
 *    None of that may reach the record.
 *
 * Nothing here touches a live database: `@/lib/db` is PGlite built from the
 * committed migration, and no file is ever opened — the CV's size and type
 * come from `stored_file`, which is a row.
 */

const state = vi.hoisted(() => ({ pg: null as TestDatabase | null }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/db", async () => {
  const schema = await vi.importActual<typeof import("@/lib/db/schema")>("@/lib/db/schema");
  const { createTestDatabase } = await import("@/lib/db/testing");
  state.pg = await createTestDatabase();
  return { ...schema, schema, getDb: () => state.pg!.db };
});

import { applicantAccount, storedFile } from "@/lib/db/schema";
import { type RecordGroup, getApplicantRecord } from "./applicant-record";

const EMAIL = "bat@example.mn";
const REGNO = "УБ99010101";
const PHONE = "99112233";
/** The one raw upstream message the document is allowed to keep. */
const LEAKY_RETMSG = `Бат Доржийн РД ${REGNO} буруу утга агуулж байна`;

beforeEach(async () => {
  await state.pg!.reset();
  vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

/* --- the document --------------------------------------------------------- */

/** Everything a filled-in анкет holds, as `/api/me` stores it. */
const FULL = {
  profile: {
    lastname: "Дорж",
    firstname: "Бат",
    regno: REGNO,
    mobilephone: PHONE,
    email2: "bat.d@example.mn",
    maritalstatus: "M",
    addr2: "3-р хороо, 12-р байр",
    countryid: 28,
    countryname: "Монгол",
    divisionid: 1,
    divisionname: "Улаанбаатар",
    districtid: 7,
    districtname: "Баянзүрх",
    contactname: "Дорж Оюун",
    relativeid: 3,
    relativename: "/03/ Эгч",
    contactphone: "99009900",
    contactname2: "",
    relativename2: "",
    contactphone2: "",
    isa: false,
    isb: true,
    isc: true,
    isd: false,
    ise: false,
    custom1: "Ах маань Шунхлайд ажилладаг.",
    custom2: "",
  },
  education: [
    {
      entryid: 1,
      countryid: 28,
      countryname: "Монгол",
      divisionname: "Улаанбаатар",
      universityid: 68,
      universityname: "/68/ МУИС-ГХСС",
      professionid: 2414,
      professionname: "AI Инженер",
      educationlevelid: 2010,
      educationlevelname: "Бакалавр",
      fromdate: "2018-09-01",
      todate: "2022-06-15",
      gpa: 3.6,
      certificateno: "D-2022-114",
      thesis: "Монгол хэлний хэлц ялгах загвар",
      note: "",
    },
  ],
  languages: [
    {
      entryid: 2,
      forlanguageid: 15,
      forlanguagename: "Англи",
      listeninglevelname: "Дунд",
      speakinglevelname: "Дунд",
      readinglevelname: "Дээд түвшин",
      writinglevelname: "Анхан",
      studytime: 6,
      score: "IELTS 6.5",
    },
  ],
  skills: [
    { entryid: 3, skillcompid: 0, compnametext: "Power BI", levelname: "Дээд түвшин", note: "" },
  ],
  experience: [
    {
      entryid: 4,
      orgname: "Мон Дата ХХК",
      businesstypeid: 1,
      businesstypename: "Хүнс үйлдвэрлэл",
      jobid: 7134,
      jobname: "/7134/ Дата инженер",
      fromdate: "2022-07-01",
      isworking: "Y",
      todate: "",
      basewage: 2400000,
      responsibility: "ETL шугам хөгжүүлэх",
      reason: "",
      headname: "Сараа",
      headjobname: "CTO",
      headphone: "88008800",
    },
  ],
  family: [
    {
      entryid: 5,
      relativeid: 1,
      relativename: "/01/ Эцэг",
      lastname: "Цэрэн",
      firstname: "Дорж",
      gender: "M",
      famregno: "УБ65010101",
      birthdate: "1965.01.01",
      orgname: "Тэнгис ХХК",
      jobname: "Механикч",
      phone: "95009500",
      note: "",
    },
  ],
  interests: [
    { entryid: 6, posgroupid: 47, posgroupname: "/47/ Инженер", positionid: 9, positionname: "/02-007/ Дата инженер" },
  ],
  qualifications: [
    { entryid: 7, universityid: 68, name: "PMP", certificateno: "PMP-9912", fromdate: "2024-03-01", grantedby: "PMI" },
  ],
  cv: { filename: "Бат_Дорж_CV.pdf" },
  picture: true,
  nextEntryId: 1_000_000_002,
  erp: {
    maritalOptions: [
      { key: "M", text: "Гэрлэсэн" },
      { key: "S", text: "Гэрлээгүй" },
    ],
    // The sync's own bookkeeping, including the one upstream message.
    loginPhone: PHONE,
    withdrawRefused: { "4242": LEAKY_RETMSG },
  },
};

async function seed(doc: unknown = FULL, email = EMAIL) {
  await state.pg!.db.insert(applicantAccount).values({
    id: `acc_${email}`,
    email,
    clerkUserId: "user_1",
    dataJson: JSON.stringify(doc),
  });
}

/** The record, with the groups indexed by their Mongolian heading. */
async function record(email = EMAIL) {
  const found = await getApplicantRecord(email);
  const groups = new Map<string, RecordGroup>((found?.groups ?? []).map((g) => [g.title, g]));
  return { found, groups };
}

/** Every string a reader would see, across every group. */
const everythingPrinted = (groups: RecordGroup[]): string[] =>
  groups.flatMap((group) => [
    ...(group.fields ?? []).map((field) => field.value),
    ...(group.entries ?? []).flatMap(entryStrings),
  ]);

const entryStrings = (entry: { title: string; summary?: string; fields: { value: string }[] }) => [
  entry.title,
  entry.summary ?? "",
  ...entry.fields.map((field) => field.value),
];

/** One group's `<dt>: <dd>` lines, flattened for an assertion. */
const fields = (group: RecordGroup | undefined) =>
  Object.fromEntries((group?.fields ?? []).map((field) => [field.label, field.value]));

/* --- the person ----------------------------------------------------------- */

describe("the personal section", () => {
  it("carries the регистр, the утас and both e-mail addresses", async () => {
    await seed();
    const { groups } = await record();

    expect(fields(groups.get("Хувийн мэдээлэл"))).toEqual({
      "Эцэг/эх-ийн нэр": "Дорж",
      Нэр: "Бат",
      "Регистрийн дугаар": REGNO,
      Утас: PHONE,
      Имэйл: "bat.d@example.mn",
      "Бүртгэлийн и-мэйл": EMAIL,
      "Гэрлэлтийн байдал": "Гэрлэсэн",
      "Жолооны ангилал": "B, C",
    });
  });

  it("prints the marital code as it stands when no option list was pulled", async () => {
    await seed({ ...FULL, erp: {} });
    const { groups } = await record();
    expect(fields(groups.get("Хувийн мэдээлэл"))["Гэрлэлтийн байдал"]).toBe("M");
  });

  it("builds the address from the labels the row stores, not its ids", async () => {
    await seed();
    const { groups } = await record();
    expect(fields(groups.get("Гэрийн хаяг"))).toEqual({
      Улс: "Монгол",
      "Аймаг, хот": "Улаанбаатар",
      "Сум, дүүрэг": "Баянзүрх",
      "Дэлгэрэнгүй хаяг": "3-р хороо, 12-р байр",
    });
  });

  it("lists only the emergency contact that was filled in, with its code stripped", async () => {
    await seed();
    const { groups } = await record();
    expect(groups.get("Яаралтай үед холбоо барих хүн")?.entries).toEqual([
      { title: "Дорж Оюун", summary: "Эгч", fields: [{ label: "Утас", value: "99009900" }] },
    ]);
  });

  it("keeps an answered «Бусад» question and drops an unanswered one", async () => {
    await seed();
    const { groups } = await record();
    const answers = groups.get("Бусад")?.entries ?? [];
    expect(answers).toHaveLength(1);
    expect(answers[0].title).toContain("хамаатан садан");
    expect(answers[0].summary).toBe("Ах маань Шунхлайд ажилладаг.");
  });
});

/* --- the sections --------------------------------------------------------- */

describe("the repeating sections", () => {
  it("heads every section that has rows, in the order of the applicant's own screens", async () => {
    await seed();
    const { found } = await record();
    expect(found?.groups.map((group) => group.title)).toEqual([
      "Хувийн мэдээлэл",
      "Гэрийн хаяг",
      "Яаралтай үед холбоо барих хүн",
      "Бусад",
      "Боловсрол",
      "Гадаад хэл",
      "Компьютерийн ур чадвар",
      "Ажлын туршлага",
      "Гэр бүл",
      "Сонирхсон ажлын байр",
      "Гэрчилгээ, сертификат",
    ]);
  });

  it("formats an education row: the school heads it, dates read as dates, ids are gone", async () => {
    await seed();
    const { groups } = await record();
    const [entry] = groups.get("Боловсрол")?.entries ?? [];

    expect(entry.title).toBe("МУИС-ГХСС");
    expect(entry.summary).toBe("Бакалавр");
    expect(entry.fields).toEqual([
      { label: "Мэргэжил", value: "AI Инженер" },
      { label: "Улс", value: "Монгол" },
      { label: "Хот, аймаг", value: "Улаанбаатар" },
      { label: "Элссэн огноо", value: "2018.09.01" },
      { label: "Төгссөн огноо", value: "2022.06.15" },
      { label: "Голч дүн", value: "3.6" },
      { label: "Дипломын дугаар", value: "D-2022-114" },
      { label: "Дипломын ажлын сэдэв", value: "Монгол хэлний хэлц ялгах загвар" },
    ]);
  });

  it("reads a language row's four levels", async () => {
    await seed();
    const { groups } = await record();
    const [entry] = groups.get("Гадаад хэл")?.entries ?? [];
    expect(entry.title).toBe("Англи");
    expect(entry.fields).toEqual([
      { label: "Сонсох", value: "Дунд" },
      { label: "Ярих", value: "Дунд" },
      { label: "Унших", value: "Дээд түвшин" },
      { label: "Бичих", value: "Анхан" },
      { label: "Судалсан хугацаа (жил)", value: "6" },
      { label: "Шалгалтын оноо", value: "IELTS 6.5" },
    ]);
  });

  it("heads a skill the list did not have by the name that was typed instead", async () => {
    await seed();
    const { groups } = await record();
    expect(groups.get("Компьютерийн ур чадвар")?.entries).toEqual([
      { title: "Power BI", summary: "Дээд түвшин", fields: [] },
    ]);
  });

  it("formats an experience row: still-working, grouped wage, no empty leaving date", async () => {
    await seed();
    const { groups } = await record();
    const [entry] = groups.get("Ажлын туршлага")?.entries ?? [];

    expect(entry.title).toBe("Мон Дата ХХК");
    expect(entry.summary).toBe("Дата инженер");
    expect(entry.fields).toEqual([
      { label: "Үйл ажиллагааны чиглэл", value: "Хүнс үйлдвэрлэл" },
      { label: "Ажилд орсон", value: "2022.07.01" },
      { label: "Одоо ажиллаж байгаа", value: "Тийм" },
      { label: "Үндсэн цалин", value: (2_400_000).toLocaleString("mn-MN") },
      { label: "Гүйцэтгэсэн үүрэг", value: "ETL шугам хөгжүүлэх" },
      { label: "Шууд удирдлагын нэр", value: "Сараа" },
      { label: "Удирдлагын албан тушаал", value: "CTO" },
      { label: "Удирдлагын утас", value: "88008800" },
    ]);
  });

  it("reads a family member's gender code and their own регистр", async () => {
    await seed();
    const { groups } = await record();
    const [entry] = groups.get("Гэр бүл")?.entries ?? [];

    expect(entry.title).toBe("Цэрэн");
    expect(entry.summary).toBe("Эцэг");
    expect(entry.fields).toEqual([
      { label: "Нэр", value: "Дорж" },
      { label: "Хүйс", value: "Эрэгтэй" },
      { label: "Регистрийн дугаар", value: "УБ65010101" },
      { label: "Төрсөн огноо", value: "1965.01.01" },
      { label: "Ажлын газар", value: "Тэнгис ХХК" },
      { label: "Албан тушаал", value: "Механикч" },
      { label: "Холбоо барих утас", value: "95009500" },
    ]);
  });

  it("strips the position codes off an interested posting", async () => {
    await seed();
    const { groups } = await record();
    expect(groups.get("Сонирхсон ажлын байр")?.entries).toEqual([
      { title: "Инженер", summary: "Дата инженер", fields: [] },
    ]);
  });

  /**
   * The four lists the ERP pulls in and this site has no form for. Nothing
   * documents their columns, so the rule is "print it unless it is an id" —
   * a field HR can read under a raw key beats a field they never see.
   */
  it("prints a section it has no spec for off the keys the row turns out to have", async () => {
    await seed();
    const { groups } = await record();
    expect(groups.get("Гэрчилгээ, сертификат")?.entries).toEqual([
      {
        title: "PMP",
        fields: [
          { label: "Нэр", value: "PMP" },
          { label: "Дугаар", value: "PMP-9912" },
          { label: "Эхэлсэн", value: "2024.03.01" },
          { label: "grantedby", value: "PMI" },
        ],
      },
    ]);
  });

  it("leaves out a section whose rows are all empty", async () => {
    await seed({ ...FULL, projects: [{ entryid: 9, projectid: 4 }] });
    const { groups } = await record();
    expect(groups.has("Хэрэгжүүлсэн төсөл")).toBe(false);
  });
});

/* --- the files ------------------------------------------------------------ */

describe("the CV", () => {
  it("describes it from stored_file when the bytes have been moved to disk", async () => {
    await seed();
    await state.pg!.db.insert(storedFile).values({
      id: "fil_1",
      sha256: "a".repeat(64),
      contentType: "application/pdf",
      byteSize: 421_889,
      ownerKind: "applicant_cv",
      ownerKey: EMAIL,
      filename: "Бат_Дорж_CV.pdf",
    });

    const { found } = await record();
    expect(found?.cv).toEqual({
      filename: "Бат_Дорж_CV.pdf",
      contentType: "application/pdf",
      byteSize: 421_889,
    });
    expect(found?.hasPhoto).toBe(true);
  });

  it("falls back to the type its name implies while the file is still in chunks", async () => {
    await seed({ ...FULL, cv: { filename: "cv.docx" } });
    const { found } = await record();
    expect(found?.cv).toEqual({
      filename: "cv.docx",
      contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      byteSize: 0,
    });
  });

  it("says there is none when the document has no CV", async () => {
    await seed({ ...FULL, cv: null, picture: false });
    const { found } = await record();
    expect(found?.cv).toBeNull();
    expect(found?.hasPhoto).toBe(false);
  });
});

/* --- the edges ------------------------------------------------------------ */

describe("what it answers when there is nothing to read", () => {
  it("is null for an account nobody has", async () => {
    await seed();
    await expect(getApplicantRecord("nobody@example.mn")).resolves.toBeNull();
    await expect(getApplicantRecord("")).resolves.toBeNull();
  });

  it("finds the account whatever case the caller spells the email in", async () => {
    await seed();
    await expect(getApplicantRecord(" BAT@Example.MN ")).resolves.toMatchObject({ email: EMAIL });
  });

  it("survives a document that is not valid JSON, and says the анкет is empty", async () => {
    await state.pg!.db.insert(applicantAccount).values({
      id: "acc_broken",
      email: "broken@example.mn",
      clerkUserId: null,
      dataJson: "{not json",
    });

    const found = await getApplicantRecord("broken@example.mn");
    expect(found?.empty).toBe(true);
    expect(found?.groups.map((group) => group.title)).toEqual(["Хувийн мэдээлэл"]);
    expect(found?.cv).toBeNull();
  });

  it("is not empty once a section has been filled in", async () => {
    await seed();
    const { found } = await record();
    expect(found?.empty).toBe(false);
    expect(found?.name).toBe("Дорж Бат");
  });
});

/* --- what must not be on it ----------------------------------------------- */

describe("what the record does not copy", () => {
  it("never carries the sync's bookkeeping or the ERP's own words", async () => {
    await seed();
    const serialized = JSON.stringify(await getApplicantRecord(EMAIL));

    // The document's one raw upstream message, and the field it hides in.
    expect(serialized).not.toContain(LEAKY_RETMSG);
    expect(serialized).not.toContain("withdrawRefused");
    // `erp.loginPhone` is the ERP password as the ERP last accepted it; the
    // утас is shown once, as a phone number, and never a second time as that.
    expect(serialized).not.toContain("loginPhone");
    expect(serialized).not.toContain("maritalOptions");
  });

  it("prints no ERP id anywhere, in any section", async () => {
    await seed();
    const { found } = await record();
    const printed = everythingPrinted(found?.groups ?? []).join("\n");

    // Every id in the fixture, none of which is a value a person reads.
    for (const id of ["2414", "2010", "7134", "1000000001", "/47/", "/68/", "/03/"]) {
      expect(printed, id).not.toContain(id);
    }
  });
});
