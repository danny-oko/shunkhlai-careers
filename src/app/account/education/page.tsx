"use client";

import { SectionManager, type FieldDef } from "@/components/account/section-manager";
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
    name: "universityid",
    label: "Сургууль",
    type: "select",
    required: true,
    deps: ["countryid"],
    load: (values) =>
      reference.universities({ countryid: Number(values.countryid) || 0 }),
  },
  {
    name: "universitynametext",
    label: "Сургууль (жагсаалтад байхгүй бол)",
    type: "text",
  },
  {
    name: "professionid",
    label: "Мэргэжил",
    type: "select",
    load: () => reference.professions(),
  },
  {
    name: "educationlevelid",
    label: "Боловсролын зэрэг",
    type: "select",
    required: true,
    load: () => reference.educationLevels(),
  },
  { name: "fromdate", label: "Элссэн", type: "date" },
  { name: "todate", label: "Төгссөн", type: "date" },
  { name: "isgraduated", label: "Төгссөн эсэх", type: "yesno" },
  { name: "gpa", label: "Голч дүн", type: "number" },
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
  { name: "studytime", label: "Судалсан хугацаа (жил)", type: "number" },
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
    name: "levelid",
    label: "Эзэмшсэн түвшин",
    type: "select",
    required: true,
    deps: ["skillcompid"],
    load: (values) =>
      reference.computerSkillLevels({ skillcompid: Number(values.skillcompid) || 0 }),
  },
  { name: "compnametext", label: "Программ (жагсаалтад байхгүй бол)", type: "text" },
  { name: "note", label: "Тэмдэглэл", type: "textarea", wide: true },
];

export default function EducationPage() {
  return (
    <div className="space-y-12">
      <SectionManager<EducationEntry>
        title="Боловсрол"
        description="Төгссөн болон суралцаж буй сургуулиудаа нэмнэ үү."
        resource={sections.education}
        fields={educationFields}
        defaults={{ isgraduated: "Y" }}
        primary={(row) =>
          row.universityname || row.universitynametext || "Сургууль"
        }
        secondary={(row) =>
          [row.professionname, row.educationlevelname, row.todate]
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
          [row.score, row.studytime ? `${row.studytime} жил` : ""]
            .filter(Boolean)
            .join(" · ")
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
