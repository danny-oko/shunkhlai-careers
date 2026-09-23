"use client";

import { SectionManager, type FieldDef } from "@/components/account/section-manager";
import { sharedLoader } from "@/components/account/use-dropdown";
import { useHomeCountry } from "@/components/account/use-home-country";
import { Separator } from "@/components/ui/separator";
import { reference, sections } from "@/lib/api";
import type {
  ComputerSkillEntry,
  EducationEntry,
  LanguageEntry,
} from "@/lib/api/sections";

/**
 * Education, languages and computer skills share one bundle endpoint
 * (`GetHrAppEducationData`), so they share one screen too.
 */

const educationFields: FieldDef[] = [
  {
    name: "countryid",
    label: "Улс",
    type: "select",
    load: () => reference.countries(),
  },
  {
    name: "divisionid",
    label: "Хот, аймаг",
    type: "select",
    deps: ["countryid"],
    depsRequired: true,
    load: (values) => reference.divisions({ countryid: Number(values.countryid) || 0 }),
  },
  {
    name: "universityid",
    label: "Сургууль",
    type: "combobox",
    required: true,
    deps: ["countryid"],
    hint: "Улсаа сонгосны дараа тухайн улсын сургуулиуд гарч ирнэ.",
    // `countryid: 0` is the collection's own "every country", so the list is
    // usable before a country is chosen rather than empty.
    load: (values, query) =>
      reference.universities({ ...query, countryid: Number(values.countryid) || 0 }),
    // An academy or training centre the list does not have: its name goes in
    // `universitynametext` with `universityid: 0` — the pair the ERP team was
    // asked to accept (the list has no «Бусад» row to pick instead).
    freeText: {
      name: "universitynametext",
      toggle: "Жагсаалтад байхгүй",
      placeholder: "Сургуулийн нэр",
    },
    emptyAs: "zero",
  },
  {
    name: "professionid",
    label: "Мэргэжил",
    type: "combobox",
    load: (_values, query) => reference.professions(query),
  },
  {
    name: "educationlevelid",
    label: "Боловсролын зэрэг",
    type: "select",
    required: true,
    load: () => reference.educationLevels(),
  },
  { name: "fromdate", label: "Элссэн огноо", type: "date" },
  {
    // Also decides `isgraduated` (see `educationPayload`).
    name: "todate",
    label: "Төгссөн огноо",
    type: "date",
    hint: "Хоосон бол одоо суралцаж байгаа гэж тооцно.",
  },
  { name: "gpa", label: "Голч дүн", type: "number" },
  { name: "gpapercent", label: "Голч дүн (хувь)", type: "number" },
  { name: "score", label: "Оноо", type: "text" },
  { name: "certificateno", label: "Дипломын дугаар", type: "text" },
  { name: "thesis", label: "Дипломын ажлын сэдэв", type: "text", wide: true },
  { name: "note", label: "Тэмдэглэл", type: "textarea", wide: true },
];

/** Сонсох / Ярих / Унших / Бичих all read the one level list. */
const LANGUAGE_SKILLS = [
  { skill: "listening", label: "Сонсох" },
  { skill: "speaking", label: "Ярих" },
  { skill: "reading", label: "Унших" },
  { skill: "writing", label: "Бичих" },
] as const;

const languageLevels = sharedLoader(() => reference.languageLevels());

const languageFields: FieldDef[] = [
  {
    name: "forlanguageid",
    label: "Гадаад хэл",
    type: "select",
    required: true,
    load: () => reference.foreignLanguages(),
  },
  { name: "studytime", label: "Судалсан хугацаа (жил)", type: "number" },
  ...LANGUAGE_SKILLS.map(
    ({ skill, label }): FieldDef => ({
      name: `${skill}levelid`,
      label,
      type: "select",
      load: languageLevels,
      // An edit that empties a level must reach the row: omitted, the saved
      // id would stay (`0` is the ERP's own "none", and reads back as blank).
      emptyAs: "zero",
    }),
  ),
  { name: "score", label: "Шалгалтын оноо", type: "text", placeholder: "IELTS 6.5" },
];

/** `score` is text on the ERP ("IELTS 6.5"), even when it was typed as a bare number. */
const languagePayload = (values: Record<string, unknown>) =>
  values.score === undefined || values.score === null
    ? values
    : { ...values, score: String(values.score).trim() };

/** "Ярих: Дунд · Унших: Дээд түвшин · 3 жил · IELTS 6.5" */
const languageSummary = (row: LanguageEntry) =>
  [
    ...LANGUAGE_SKILLS.map(({ skill, label }) => {
      const level = row[`${skill}levelname`];
      return level ? `${label}: ${level}` : "";
    }),
    Number(row.studytime) > 0 ? `${row.studytime} жил` : "",
    row.score,
  ]
    .filter(Boolean)
    .join(" · ");

const skillFields: FieldDef[] = [
  {
    name: "skillcompid",
    label: "Программ / ур чадвар",
    type: "select",
    required: true,
    load: () => reference.computerSkills(),
    // A program the list does not have: its name goes in `compnametext` with
    // `skillcompid: 0` (Postman: "Жагсаалтад байхгүй программын нэр").
    freeText: {
      name: "compnametext",
      toggle: "Жагсаалтад байхгүй",
      placeholder: "Программын нэр",
    },
    emptyAs: "zero",
  },
  {
    // The level list hangs off the program (Postman: "Тухайн ур чадварт
    // харгалзах түвшний жагсаалт"), so it waits for one and is cleared when
    // it changes. A typed program reads it under `skillcompid: 0` — live
    // (2026-09-22) that answers the same levels as any listed program.
    name: "levelid",
    label: "Эзэмшсэн түвшин",
    type: "select",
    required: true,
    deps: ["skillcompid"],
    depsRequired: true,
    load: (values) =>
      reference.computerSkillLevels({ skillcompid: Number(values.skillcompid) || 0 }),
  },
  { name: "note", label: "Тэмдэглэл", type: "textarea", wide: true },
];

/**
 * `isgraduated` is in the collection's save body; it follows Төгссөн огноо
 * rather than asking twice (the backend has been seen deriving its own
 * `graduated` from `todate` and ignoring this — sent anyway, as documented).
 * A date still ahead is an expected graduation, so not yet "Y".
 */
function isGraduated(todate: unknown, today = new Date()): "Y" | "N" {
  const value = String(todate ?? "").trim().slice(0, 10);
  if (!value) return "N";
  return value <= today.toISOString().slice(0, 10) ? "Y" : "N";
}

const educationPayload = (values: Record<string, unknown>) => ({
  ...values,
  isgraduated: isGraduated(values.todate),
});

/** A typed program has no id, so its name is the one to show. */
const programOf = (row: ComputerSkillEntry) =>
  (Number(row.skillcompid) > 0 ? row.skillcompname : row.compnametext) ||
  row.skillcompname ||
  row.compnametext ||
  "Программ";

/** A typed school has no id, so its name is the one to show. */
const schoolOf = (row: EducationEntry) =>
  (Number(row.universityid) > 0 ? row.universityname : row.universitynametext) ||
  row.universityname ||
  row.universitynametext ||
  "Сургууль";

export default function EducationPage() {
  const homeCountry = useHomeCountry();

  return (
    <div className="space-y-12">
      <SectionManager<EducationEntry>
        title="Боловсрол"
        description="Төгссөн болон суралцаж буй сургуулиудаа нэмнэ үү."
        resource={sections.education}
        fields={educationFields}
        defaults={{ ...(homeCountry ? { countryid: homeCountry } : {}) }}
        payload={educationPayload}
        primary={schoolOf}
        secondary={(row) =>
          [
            row.educationlevelname,
            row.professionname,
            // Derived from `todate` itself: the server's `graduated` flag is
            // inverted (todate set → "Үгүй", empty → "Тийм").
            row.todate ? `Төгссөн: ${row.todate}` : "Сурч байгаа",
          ]
            .filter(Boolean)
            .join(" · ")
        }
        emptyText="Боловсролын мэдээлэл алга."
      />

      <Separator />

      <SectionManager<LanguageEntry>
        title="Гадаад хэлний мэдлэг"
        resource={sections.language}
        fields={languageFields}
        defaults={{}}
        payload={languagePayload}
        primary={(row) => row.forlanguagename || "Гадаад хэл"}
        secondary={languageSummary}
        emptyText="Гадаад хэлний мэдээлэл алга."
      />

      <Separator />

      <SectionManager<ComputerSkillEntry>
        title="Компьютерийн мэдлэг"
        resource={sections.computerSkill}
        fields={skillFields}
        defaults={{}}
        primary={programOf}
        secondary={(row) => [row.levelname, row.note].filter(Boolean).join(" · ")}
        emptyText="Компьютерийн мэдлэгийн мэдээлэл алга."
      />
    </div>
  );
}
