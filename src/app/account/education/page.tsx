"use client";

import { SectionManager, type FieldDef } from "@/components/account/section-manager";
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
  },
  {
    name: "universitynametext",
    label: "Сургууль (жагсаалтад байхгүй бол)",
    type: "text",
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
    // The backend derives "graduated" from this date and ignores `isgraduated`.
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

const languageFields: FieldDef[] = [
  {
    name: "forlanguageid",
    label: "Гадаад хэл",
    type: "select",
    required: true,
    load: () => reference.foreignLanguages(),
  },
  {
    name: "listeninglevelid",
    label: "Сонсох",
    type: "select",
    load: () => reference.languageLevels(),
  },
  {
    name: "speakinglevelid",
    label: "Ярих",
    type: "select",
    load: () => reference.languageLevels(),
  },
  {
    name: "readinglevelid",
    label: "Унших",
    type: "select",
    load: () => reference.languageLevels(),
  },
  {
    name: "writinglevelid",
    label: "Бичих",
    type: "select",
    load: () => reference.languageLevels(),
  },
  { name: "score", label: "Шалгалтын оноо", type: "text", placeholder: "IELTS 6.5" },
];

const skillFields: FieldDef[] = [
  {
    name: "skillcompid",
    label: "Программ / ур чадвар",
    type: "select",
    required: true,
    load: () => reference.computerSkills(),
  },
  {
    // Every skill has its own levels — `skillcompid` is заавал here, so this
    // list means nothing until a skill is chosen.
    name: "levelid",
    label: "Эзэмшсэн түвшин",
    type: "select",
    required: true,
    deps: ["skillcompid"],
    depsRequired: true,
    load: (values) =>
      reference.computerSkillLevels({ skillcompid: Number(values.skillcompid) || 0 }),
  },
  { name: "compnametext", label: "Программ (жагсаалтад байхгүй бол)", type: "text" },
  { name: "note", label: "Тэмдэглэл", type: "textarea", wide: true },
];

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
        primary={(row) =>
          row.universityname || row.universitynametext || "Сургууль"
        }
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
        primary={(row) => row.forlanguagename || "Гадаад хэл"}
        secondary={(row) =>
          row.score ?? ""
        }
        emptyText="Гадаад хэлний мэдээлэл алга."
      />

      <Separator />

      <SectionManager<ComputerSkillEntry>
        title="Компьютерийн мэдлэг"
        resource={sections.computerSkill}
        fields={skillFields}
        defaults={{}}
        primary={(row) => row.skillcompname || row.compnametext || "Программ"}
        secondary={(row) => [row.levelname, row.note].filter(Boolean).join(" · ")}
        emptyText="Компьютерийн мэдлэгийн мэдээлэл алга."
      />
    </div>
  );
}
