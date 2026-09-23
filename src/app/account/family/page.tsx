"use client";

import { SectionManager, type FieldDef, type Values } from "@/components/account/section-manager";
import { toIsoDate } from "@/components/account/section-values";
import { staticOptions } from "@/components/account/use-dropdown";
import { useHomeCountry } from "@/components/account/use-home-country";
import { reference, sections } from "@/lib/api";
import { normalizeRegno } from "@/lib/applicant-identity";
import { REGISTER_ID_PATTERN } from "@/lib/apply-schema";
import type { FamilyEntry } from "@/lib/api/sections";

/** Every field of the Postman `SaveAppFamily` row, in the collection's order. */
const fields: FieldDef[] = [
  {
    name: "relativeid",
    label: "Таны хэн болох",
    type: "select",
    required: true,
    load: () => reference.relativeTypes(),
  },
  { name: "lastname", label: "Овог", type: "text", required: true },
  { name: "firstname", label: "Нэр", type: "text", required: true },
  {
    // Postman: `gender: "M"` — a code, not an id, so it goes as the letter.
    name: "gender",
    label: "Хүйс",
    type: "select",
    textValue: true,
    load: staticOptions([
      { value: "M", label: "Эрэгтэй" },
      { value: "F", label: "Эмэгтэй" },
    ]),
  },
  {
    name: "famregno",
    label: "Регистрийн дугаар",
    type: "text",
    placeholder: "УБ99010101",
    validate: (value) =>
      REGISTER_ID_PATTERN.test(normalizeRegno(value))
        ? null
        : "Регистрийн дугаар 2 кирилл үсэг, 8 цифрээс бүрдэнэ (жишээ нь УБ99010101).",
  },
  { name: "birthdate", label: "Төрсөн огноо", type: "date" },
  // Оршин суугаа газар: the profile's chain (Postman points at the `03`
  // dropdowns). Each list hangs off the one above and is emptied with it.
  {
    name: "countryid",
    label: "Оршин суугаа улс",
    type: "select",
    load: () => reference.countries(),
  },
  {
    name: "divisionid",
    label: "Аймаг, хот",
    type: "select",
    deps: ["countryid"],
    depsRequired: true,
    load: (values) => reference.divisions({ countryid: Number(values.countryid) || 0 }),
  },
  {
    // Live (2026-09-23) GetDistrictDropDown answers nothing without a province.
    name: "districtid",
    label: "Сум, дүүрэг",
    type: "select",
    deps: ["divisionid"],
    depsRequired: true,
    load: (values) => reference.districts({ divisionid: Number(values.divisionid) || 0 }),
  },
  {
    // 878 rows — searched on the server rather than scrolled.
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
  { name: "phone", label: "Холбоо барих утас", type: "text" },
  { name: "note", label: "Тэмдэглэл", type: "textarea", wide: true },
];

/** The регистр as the ERP stores it (`УБ70010101`), the phone as text. */
const familyPayload = (values: Values): Values => {
  const body: Values = { ...values, famregno: normalizeRegno(values.famregno) };
  if (body.phone !== undefined && body.phone !== null) body.phone = String(body.phone).trim();
  return body;
};

/** Full years between `birthdate` and `today`, or null for a date it cannot read. */
function ageOf(birthdate: string, today = new Date()): number | null {
  if (!birthdate) return null;
  const [year, month, day] = birthdate.split("-").map(Number);
  const md = (today.getMonth() + 1) * 100 + today.getDate();
  const age = today.getFullYear() - year - (md < month * 100 + day ? 1 : 0);
  return age >= 0 ? age : null;
}

/** "1970-01-01 (56 нас)" */
const bornOf = (row: FamilyEntry) => {
  const date = toIsoDate(row.birthdate);
  const age = ageOf(date);
  return date ? (age === null ? date : `${date} (${age} нас)`) : "";
};

const nameOf = (row: FamilyEntry) =>
  [row.lastname, row.firstname].filter(Boolean).join(" ") || "Гишүүн";

export default function FamilyPage() {
  const homeCountry = useHomeCountry();

  return (
    <SectionManager<FamilyEntry>
      title="Гэр бүлийн мэдээлэл"
      description="Гэр бүлийн гишүүдийн мэдээллийг оруулна уу."
      resource={sections.family}
      fields={fields}
      defaults={{ ...(homeCountry ? { countryid: homeCountry } : {}) }}
      payload={familyPayload}
      primary={(row) => [row.relativename, nameOf(row)].filter(Boolean).join(" · ")}
      secondary={(row) =>
        [bornOf(row), row.orgname, row.jobname].filter(Boolean).join(" · ")
      }
      emptyText="Гэр бүлийн мэдээлэл алга."
    />
  );
}
