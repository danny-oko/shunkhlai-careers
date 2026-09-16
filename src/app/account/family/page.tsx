"use client";

import { SectionManager, type FieldDef } from "@/components/account/section-manager";
import { staticOptions } from "@/components/account/use-dropdown";
import { reference, sections } from "@/lib/api";
import type { FamilyEntry } from "@/lib/api/sections";

const fields: FieldDef[] = [
  {
    name: "relativeid",
    label: "Хэн болох",
    type: "select",
    required: true,
    load: () => reference.relativeTypes(),
  },
  { name: "lastname", label: "Овог", type: "text", required: true },
  { name: "firstname", label: "Нэр", type: "text", required: true },
  {
    name: "gender",
    label: "Хүйс",
    type: "select",
    load: staticOptions([
      { value: "M", label: "Эрэгтэй" },
      { value: "F", label: "Эмэгтэй" },
    ]),
  },
  { name: "famregno", label: "Регистрийн дугаар", type: "text" },
  { name: "birthdate", label: "Төрсөн огноо", type: "date" },
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
    name: "districtid",
    label: "Сум, дүүрэг",
    type: "select",
    deps: ["divisionid"],
    depsRequired: true,
    load: (values) => reference.districts({ divisionid: Number(values.divisionid) || 0 }),
  },
  {
    name: "professionid",
    label: "Мэргэжил",
    type: "combobox",
    load: (_values, query) => reference.professions(query),
  },
  { name: "orgname", label: "Ажлын газар", type: "text" },
  {
    name: "jobid",
    label: "Албан тушаал",
    type: "combobox",
    load: (_values, query) => reference.jobTitles(query),
  },
  { name: "phone", label: "Утас", type: "text" },
  { name: "note", label: "Тэмдэглэл", type: "textarea", wide: true },
];

export default function FamilyPage() {
  return (
    <SectionManager<FamilyEntry>
      title="Гэр бүлийн мэдээлэл"
      description="Гэр бүлийн гишүүдийн мэдээллийг оруулна уу."
      resource={sections.family}
      fields={fields}
      defaults={{ gender: "M" }}
      primary={(row) => [row.lastname, row.firstname].filter(Boolean).join(" ") || "Гишүүн"}
      secondary={(row) => [row.relativename, row.phone].filter(Boolean).join(" · ")}
      emptyText="Гэр бүлийн мэдээлэл алга."
    />
  );
}
