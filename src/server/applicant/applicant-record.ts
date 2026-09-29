import "server-only";
import { eq } from "drizzle-orm";

import { deskDate } from "@/app/admin/applications/labels";
import { applicantAccount, getDb } from "@/lib/db";
import { mimeFromName } from "@/lib/file-type";
import { stripCode } from "@/lib/reference-code";
import { statOwnedFile } from "@/server/files/records";
import { normalizeEmail } from "./account-store";
import type { Row } from "./handlers";

/**
 * One applicant's анкет, for the admin who is reading their application.
 *
 * `application-desk.ts` answers "did this application reach the ERP". This
 * module answers the other question HR opens the desk with — "who is this
 * person, and what did they send us" — and it is deliberately the one place on
 * the site that hands an applicant's own details to somebody else.
 *
 * ## Why this is a separate module, and a separate read
 *
 * `DeskApplication` and `DeskApplicationDetail` carry no регистр, no phone and
 * no CV, and they still must not: they feed the list, which is read over
 * somebody's shoulder, and their tests assert exactly that. So the personal
 * data is not bolted onto those shapes. It is a second, explicit read that a
 * caller has to ask for by name, and `mayViewApplicantData` (`admin` only, see
 * `src/server/admin/guard.ts`) decides whether it is asked for at all.
 *
 * ## What it shows, and what it costs
 *
 * Everything the applicant filled in on `/account/**`: the personal section,
 * the address, the driving classes, the two «Бусад» answers, the emergency
 * contacts, and every repeating section — боловсрол, хэл, компьютерийн ур
 * чадвар, туршлага, гэр бүл, сонирхсон ажлын байр. Plus the CV's metadata, so
 * the page can offer it, and whether a photo exists.
 *
 * Two things follow from that and are said on the screen rather than left for
 * a reader to discover:
 *
 * - **the утас is the applicant's ERP password** (`lib/api/README.md`), and
 *   the регистр is the other half of that login. They are shown because HR
 *   cannot phone a candidate they have no number for, not because they are
 *   ordinary fields.
 * - the values are **the mirror's**, not the ERP's. A field the applicant
 *   changed in the ERP by another route is not here.
 *
 * ## Shape
 *
 * The builder does all the formatting — dates through the desk's own
 * `deskDate`, ids dropped, ERP reference codes stripped — so the component is
 * a dumb renderer and a test can assert on what actually reaches the screen.
 * Nothing upstream is copied: no `retmsg` lives in the profile or in a section
 * row, and `doc.erp` (which does hold one, in `withdrawRefused`) is read for
 * exactly one thing — the гэрлэлтийн байдал option list.
 */

/* --- shapes -------------------------------------------------------------- */

/** One `<dt>/<dd>` line. `value` is already display-ready. */
export type RecordField = { label: string; value: string };

/** One row of a repeating section. */
export type RecordEntry = {
  /** The heading: a school, an employer, a family member's name. */
  title: string;
  /** The one-line summary under it, when the row has one. */
  summary?: string;
  fields: RecordField[];
};

/**
 * A block of the record: either a one-off list of fields (Хувийн мэдээлэл) or
 * a repeating section (Боловсрол). Never both, and a block with nothing in it
 * is not built at all.
 */
export type RecordGroup = { title: string; fields?: RecordField[]; entries?: RecordEntry[] };

/** The stored CV, described but not opened. */
export type RecordFile = { filename: string; contentType: string; byteSize: number };

export type ApplicantRecord = {
  /** The account key — the same email `DeskApplicationDetail` carries. */
  email: string;
  /** «Овог Нэр», or empty. */
  name: string;
  groups: RecordGroup[];
  cv: RecordFile | null;
  hasPhoto: boolean;
  /** No section of the анкет has been filled in at all. */
  empty: boolean;
};

/* --- reading the document ------------------------------------------------ */

type StoredShape = {
  profile?: Row;
  cv?: { filename?: string } | null;
  picture?: boolean;
  erp?: { maritalOptions?: Array<{ key?: unknown; text?: unknown }> };
  [section: string]: unknown;
};

const text = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "";
  if (typeof value === "boolean") return value ? "Тийм" : "";
  return typeof value === "string" ? value.trim() : "";
};

/** A reference label with its ERP code dropped; `/03/ Бакалавр` → `Бакалавр`. */
const label = (value: unknown): string => stripCode(text(value));

/** The first of these keys that has a value. */
const first = (row: Row, keys: readonly string[]): string => {
  for (const key of keys) {
    const value = label(row[key]);
    if (value) return value;
  }
  return "";
};

const rows = (stored: StoredShape, key: string): Row[] => {
  const list = stored[key];
  return Array.isArray(list) ? (list as Row[]) : [];
};

/* --- field specs --------------------------------------------------------- */

/**
 * How one stored key is printed. The labels are the ones the applicant saw on
 * their own form (`src/app/account/**`), so HR and the applicant are reading
 * the same words for the same field.
 */
type Spec = {
  key: string;
  label: string;
  /** `date`: through `deskDate`. `amount`: grouped digits. `flag`: Y/N. */
  as?: "date" | "amount" | "flag" | "gender";
};

const GENDERS: Readonly<Record<string, string>> = { M: "Эрэгтэй", F: "Эмэгтэй" };

function value(row: Row, spec: Spec): string {
  const raw = row[spec.key];
  switch (spec.as) {
    case "date":
      return text(raw) ? deskDate(text(raw)) : "";
    case "amount": {
      const amount = Number(raw);
      return Number.isFinite(amount) && amount !== 0 ? amount.toLocaleString("mn-MN") : "";
    }
    case "flag": {
      const flag = text(raw).toUpperCase();
      if (flag === "Y" || flag === "TRUE" || flag === "ТИЙМ") return "Тийм";
      return flag === "N" || flag === "FALSE" ? "Үгүй" : "";
    }
    case "gender":
      return GENDERS[text(raw).toUpperCase()] ?? "";
    default:
      return label(raw);
  }
}

/** Every spec that has a value on this row, in the order the form had them. */
const fieldsOf = (row: Row, specs: readonly Spec[]): RecordField[] =>
  specs
    .map((spec) => ({ label: spec.label, value: value(row, spec) }))
    .filter((field) => field.value !== "");

/* --- the personal section ------------------------------------------------ */

const PERSONAL: readonly Spec[] = [
  { key: "lastname", label: "Эцэг/эх-ийн нэр" },
  { key: "firstname", label: "Нэр" },
  { key: "regno", label: "Регистрийн дугаар" },
  { key: "mobilephone", label: "Утас" },
  { key: "email2", label: "Имэйл" },
];

const ADDRESS: readonly Spec[] = [
  { key: "countryname", label: "Улс" },
  { key: "divisionname", label: "Аймаг, хот" },
  { key: "districtname", label: "Сум, дүүрэг" },
  { key: "addr2", label: "Дэлгэрэнгүй хаяг" },
];

const LICENCES = ["isa", "isb", "isc", "isd", "ise"] as const;

/** The two free-text «Бусад» questions, worded as the applicant was asked them. */
const QUESTIONS: readonly { key: string; question: string }[] = [
  {
    key: "custom1",
    question:
      "Манай компанид одоогийн байдлаар таны хамаатан садан эсвэл танил, найз нөхөд ажилладаг уу?",
  },
  {
    key: "custom2",
    question: "Таныг манай компанид ажилд орохыг санал болгосон БВМ-ийн ажилтан байгаа юу?",
  },
];

/**
 * `maritalstatus` is stored as the ERP's own code; the list that gives it a
 * name is whatever the last pull of `/get` left in `doc.erp.maritalOptions`.
 * Without it the code is printed as it stands rather than hidden — a reader
 * seeing `M` can ask, a reader seeing nothing cannot.
 */
function marital(stored: StoredShape): string {
  const code = text(stored.profile?.maritalstatus);
  if (!code) return "";
  const options = stored.erp?.maritalOptions ?? [];
  const found = Array.isArray(options)
    ? options.find((option) => text(option?.key) === code)
    : undefined;
  return label(found?.text) || code;
}

const licences = (profile: Row): string =>
  LICENCES.filter((key) => profile[key] === true || text(profile[key]).toUpperCase() === "Y")
    .map((key) => key.slice(2).toUpperCase())
    .join(", ");

function personalGroups(stored: StoredShape, email: string): RecordGroup[] {
  const profile = stored.profile ?? {};
  const groups: RecordGroup[] = [];

  const personal = fieldsOf(profile, PERSONAL);
  // The account key belongs with the person, not with the push: it is what
  // Clerk signed them in as, and the `email2` above is what they typed.
  personal.push({ label: "Бүртгэлийн и-мэйл", value: email });
  const status = marital(stored);
  if (status) personal.push({ label: "Гэрлэлтийн байдал", value: status });
  const classes = licences(profile);
  if (classes) personal.push({ label: "Жолооны ангилал", value: classes });
  groups.push({ title: "Хувийн мэдээлэл", fields: personal });

  const address = fieldsOf(profile, ADDRESS);
  if (address.length > 0) groups.push({ title: "Гэрийн хаяг", fields: address });

  const contacts = [contact(profile, ""), contact(profile, "2")].filter(
    (entry): entry is RecordEntry => entry !== null,
  );
  if (contacts.length > 0) {
    groups.push({ title: "Яаралтай үед холбоо барих хүн", entries: contacts });
  }

  const answers = QUESTIONS.map((question) => ({
    title: question.question,
    summary: text(profile[question.key]),
    fields: [],
  })).filter((entry) => entry.summary !== "");
  if (answers.length > 0) groups.push({ title: "Бусад", entries: answers });

  return groups;
}

/** One emergency contact, or null when that slot was left empty. */
function contact(profile: Row, suffix: "" | "2"): RecordEntry | null {
  const name = label(profile[`contactname${suffix}`]);
  const relative = label(profile[`relativename${suffix}`]);
  const phone = text(profile[`contactphone${suffix}`]);
  if (!name && !relative && !phone) return null;
  return {
    title: name || relative || "Холбоо барих хүн",
    ...(relative ? { summary: relative } : {}),
    fields: phone ? [{ label: "Утас", value: phone }] : [],
  };
}

/* --- the repeating sections ---------------------------------------------- */

/**
 * A section of the анкет: where its rows live in the document, what heads each
 * row, and what is printed under it.
 *
 * `qualifications`, `projects`, `internships` and `relatives` are not here.
 * They are read-only lists the ERP pulls in and this site has never had a form
 * for, so no field of theirs is documented anywhere — `generic()` prints them
 * off whatever keys the row turns out to have.
 */
type SectionSpec = {
  key: string;
  title: string;
  /** Keys tried in order for the row's heading. */
  heading: readonly string[];
  /** Keys tried in order for the line under it. */
  summary?: readonly string[];
  fields: readonly Spec[];
};

const LANGUAGE_LEVELS: readonly Spec[] = [
  { key: "listeninglevelname", label: "Сонсох" },
  { key: "speakinglevelname", label: "Ярих" },
  { key: "readinglevelname", label: "Унших" },
  { key: "writinglevelname", label: "Бичих" },
];

const SECTIONS: readonly SectionSpec[] = [
  {
    key: "education",
    title: "Боловсрол",
    heading: ["universityname", "universitynametext"],
    summary: ["educationlevelname", "professionname"],
    fields: [
      { key: "professionname", label: "Мэргэжил" },
      { key: "countryname", label: "Улс" },
      { key: "divisionname", label: "Хот, аймаг" },
      { key: "fromdate", label: "Элссэн огноо", as: "date" },
      { key: "todate", label: "Төгссөн огноо", as: "date" },
      { key: "gpa", label: "Голч дүн" },
      { key: "gpapercent", label: "Голч дүн (хувь)" },
      { key: "score", label: "Оноо" },
      { key: "certificateno", label: "Дипломын дугаар" },
      { key: "thesis", label: "Дипломын ажлын сэдэв" },
      { key: "note", label: "Тэмдэглэл" },
    ],
  },
  {
    key: "languages",
    title: "Гадаад хэл",
    heading: ["forlanguagename"],
    fields: [
      ...LANGUAGE_LEVELS,
      { key: "studytime", label: "Судалсан хугацаа (жил)" },
      { key: "score", label: "Шалгалтын оноо" },
    ],
  },
  {
    key: "skills",
    title: "Компьютерийн ур чадвар",
    heading: ["skillcompname", "compnametext"],
    summary: ["levelname"],
    fields: [{ key: "note", label: "Тэмдэглэл" }],
  },
  {
    key: "experience",
    title: "Ажлын туршлага",
    heading: ["orgname"],
    summary: ["jobname"],
    fields: [
      { key: "businesstypename", label: "Үйл ажиллагааны чиглэл" },
      { key: "businesstypenametext", label: "Үйл ажиллагааны чиглэл" },
      { key: "fromdate", label: "Ажилд орсон", as: "date" },
      { key: "isworking", label: "Одоо ажиллаж байгаа", as: "flag" },
      { key: "todate", label: "Ажлаас гарсан", as: "date" },
      { key: "basewage", label: "Үндсэн цалин", as: "amount" },
      { key: "responsibility", label: "Гүйцэтгэсэн үүрэг" },
      { key: "reason", label: "Гарсан шалтгаан" },
      { key: "headname", label: "Шууд удирдлагын нэр" },
      { key: "headjobname", label: "Удирдлагын албан тушаал" },
      { key: "headphone", label: "Удирдлагын утас" },
    ],
  },
  {
    key: "family",
    title: "Гэр бүл",
    heading: ["lastname", "firstname"],
    summary: ["relativename"],
    fields: [
      { key: "firstname", label: "Нэр" },
      { key: "gender", label: "Хүйс", as: "gender" },
      { key: "famregno", label: "Регистрийн дугаар" },
      { key: "birthdate", label: "Төрсөн огноо", as: "date" },
      { key: "countryname", label: "Оршин суугаа улс" },
      { key: "divisionname", label: "Аймаг, хот" },
      { key: "districtname", label: "Сум, дүүрэг" },
      { key: "professionname", label: "Мэргэжил" },
      { key: "orgname", label: "Ажлын газар" },
      { key: "jobname", label: "Албан тушаал" },
      { key: "phone", label: "Холбоо барих утас" },
      { key: "note", label: "Тэмдэглэл" },
    ],
  },
  {
    key: "interests",
    title: "Сонирхсон ажлын байр",
    heading: ["posgroupname"],
    summary: ["positionname"],
    fields: [],
  },
];

/** The sections with no form on this site: printed off the keys they carry. */
const GENERIC: readonly { key: string; title: string }[] = [
  { key: "qualifications", title: "Гэрчилгээ, сертификат" },
  { key: "projects", title: "Хэрэгжүүлсэн төсөл" },
  { key: "internships", title: "Дадлага" },
  { key: "relatives", title: "Бусад хамаатан" },
];

function sectionGroup(stored: StoredShape, spec: SectionSpec): RecordGroup | null {
  const entries: RecordEntry[] = [];
  for (const row of rows(stored, spec.key)) {
    const summary = spec.summary ? first(row, spec.summary) : "";
    const fields = fieldsOf(row, spec.fields).filter((field) => field.value !== summary);
    const title = first(row, spec.heading);
    if (!title && !summary && fields.length === 0) continue;
    entries.push({
      title: title || summary || spec.title,
      ...(summary && summary !== title ? { summary } : {}),
      fields,
    });
  }
  return entries.length > 0 ? { title: spec.title, entries } : null;
}

/** Labels for the keys the undocumented ERP lists have been seen carrying. */
const GENERIC_LABELS: Readonly<Record<string, string>> = {
  name: "Нэр",
  orgname: "Байгууллага",
  companyname: "Байгууллага",
  projectname: "Төслийн нэр",
  position: "Албан тушаал",
  jobname: "Албан тушаал",
  professionname: "Мэргэжил",
  relativename: "Таны хэн болох",
  lastname: "Овог",
  firstname: "Нэр",
  phone: "Утас",
  fromdate: "Эхэлсэн",
  todate: "Дууссан",
  certificateno: "Дугаар",
  score: "Оноо",
  note: "Тэмдэглэл",
  description: "Тайлбар",
  duration: "Хугацаа",
};

const HEADING_KEYS = [
  "name",
  "projectname",
  "orgname",
  "companyname",
  "certificatename",
  "lastname",
  "firstname",
] as const;

/**
 * A row of a section nothing here has a spec for.
 *
 * Ids are dropped (`entryid`, anything ending in `id`) — they are the ERP's
 * bookkeeping and mean nothing to a reader — as is `erp`, the sync's own
 * marker. Everything else is printed under its dictionary label, or under its
 * raw key when it has none: an unlabelled value a person can still read beats
 * a value this module decided to hide.
 */
function generic(row: Row, index: number): RecordEntry | null {
  const fields: RecordField[] = [];
  for (const [key, raw] of Object.entries(row)) {
    if (key === "erp" || /id$/iu.test(key)) continue;
    if (raw !== null && typeof raw === "object") continue;
    const printed = /date$/iu.test(key) && text(raw) ? deskDate(text(raw)) : label(raw);
    if (!printed) continue;
    fields.push({ label: GENERIC_LABELS[key] ?? key, value: printed });
  }
  if (fields.length === 0) return null;
  const title = first(row, HEADING_KEYS);
  return { title: title || `#${index + 1}`, fields };
}

function genericGroup(stored: StoredShape, spec: { key: string; title: string }): RecordGroup | null {
  const entries = rows(stored, spec.key)
    .map((row, index) => generic(row, index))
    .filter((entry): entry is RecordEntry => entry !== null);
  return entries.length > 0 ? { title: spec.title, entries } : null;
}

/* --- the CV -------------------------------------------------------------- */

/**
 * What the stored CV is, without reading it.
 *
 * `stored_file` knows the size and the type it was written with; a document
 * whose file has not been moved off `applicant_file` yet has neither, so the
 * type is derived from the name (the same answer `/api/me/cv` has always
 * served it with) and the size is left at 0 for the screen to leave out.
 * Existence is the document's own `cv`, never the file table: the applicant
 * having a CV is a fact about their анкет.
 */
async function cvOf(email: string, stored: StoredShape): Promise<RecordFile | null> {
  if (!stored.cv?.filename) return null;
  const filename = text(stored.cv.filename) || "cv";
  let file: Awaited<ReturnType<typeof statOwnedFile>> = null;
  try {
    file = await statOwnedFile("applicant_cv", email);
  } catch (error) {
    // A file table that cannot be read is not a reason to hide the CV: the
    // download route reads the bytes itself and reports its own failure.
    console.error("[admin/applications] stored_file read failed:", error);
  }
  return {
    filename,
    contentType: file?.contentType || mimeFromName(filename),
    byteSize: Number(file?.byteSize) || 0,
  };
}

/* --- the record ---------------------------------------------------------- */

function parse(json: string): StoredShape {
  try {
    const raw = JSON.parse(json) as unknown;
    return raw && typeof raw === "object" ? (raw as StoredShape) : {};
  } catch {
    // The same answer the desk gives an unparseable document: nothing in it.
    return {};
  }
}

/**
 * The анкет behind an account email, or null when there is no such account.
 *
 * Addressed by email rather than by the application's key because the caller
 * already has one: `getApplication(key)` resolved it, and a second scan of
 * every account to learn what this page already knows is a read for nothing.
 * The gate is the caller's — this function does not check a role, and the two
 * places that call it (`/admin/applications/[key]` and the file route) check
 * `mayViewApplicantData` first.
 */
export async function getApplicantRecord(email: string): Promise<ApplicantRecord | null> {
  const key = normalizeEmail(email);
  if (!key) return null;

  const [account] = await getDb()
    .select({ email: applicantAccount.email, dataJson: applicantAccount.dataJson })
    .from(applicantAccount)
    .where(eq(applicantAccount.email, key))
    .limit(1);
  if (!account) return null;

  const stored = parse(account.dataJson);
  const profile = stored.profile ?? {};
  const groups = [
    ...personalGroups(stored, account.email),
    ...SECTIONS.map((spec) => sectionGroup(stored, spec)),
    ...GENERIC.map((spec) => genericGroup(stored, spec)),
  ].filter((group): group is RecordGroup => group !== null);

  return {
    email: account.email,
    name: [text(profile.lastname), text(profile.firstname)].filter(Boolean).join(" "),
    groups,
    cv: await cvOf(account.email, stored),
    hasPhoto: stored.picture === true,
    // Only the personal block, which is built from the Clerk identity alone.
    empty: groups.length <= 1,
  };
}
