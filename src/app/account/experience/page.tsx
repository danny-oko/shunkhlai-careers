"use client";

import { SectionManager, type FieldDef, type Values } from "@/components/account/section-manager";
import { toIsoDate } from "@/components/account/section-values";
import { reference, sections } from "@/lib/api";
import type { ExperienceEntry } from "@/lib/api/sections";

const isWorking = (values: Values) => values.isworking === "Y";

const fields: FieldDef[] = [
  { name: "orgname", label: "Байгууллагын нэр", type: "text", required: true, wide: true },
  {
    name: "businesstypeid",
    label: "Үйл ажиллагааны чиглэл",
    type: "select",
    load: () => reference.businessTypes(),
    // Live (2026-09-22) the list is one row («Хүнс үйлдвэрлэл»), so most
    // answers are typed: `businesstypenametext` with the id left out — the
    // pair the ERP team was asked to accept (Careers-API-2-fixes, item 2).
    freeText: {
      name: "businesstypenametext",
      toggle: "Жагсаалтад байхгүй",
      placeholder: "Жишээ нь: Уул уурхай",
    },
  },
  {
    // 1788 rows — searched on the server rather than scrolled.
    name: "jobid",
    label: "Албан тушаал",
    type: "combobox",
    required: true,
    load: (_values, query) => reference.jobTitles(query),
  },
  { name: "fromdate", label: "Ажилд орсон", type: "date", required: true },
  // Postman: `isworking: "Y"` — одоо ажиллаж байгаа, `todate` may be empty.
  { name: "isworking", label: "Одоо ажиллаж байгаа", type: "switch" },
  {
    name: "todate",
    label: "Ажлаас гарсан",
    type: "date",
    required: true,
    hidden: isWorking,
  },
  { name: "basewage", label: "Үндсэн цалин", type: "number" },
  { name: "responsibility", label: "Гүйцэтгэсэн үүрэг", type: "textarea", wide: true },
  { name: "reason", label: "Гарсан шалтгаан", type: "text", wide: true },
  { name: "headname", label: "Шууд удирдлагын нэр", type: "text" },
  {
    name: "headjobid",
    label: "Удирдлагын албан тушаал",
    type: "combobox",
    load: (_values, query) => reference.jobTitles(query),
  },
  { name: "headphone", label: "Удирдлагын утас", type: "text" },
];

/**
 * A saved row is "still working" when it says so, or when it has no end date
 * — rows written elsewhere may carry only the date (the ERP has been seen
 * deriving its own `working` from `todate`).
 */
const experienceEdit = (row: Values): Values => ({
  ...row,
  isworking:
    row.isworking === "Y" || String(row.todate ?? "").trim() === "" ? "Y" : "N",
});

/** The Postman body: `isworking` always "Y"/"N", no end date while working, the phone as text. */
const experiencePayload = (values: Values): Values => {
  const working = isWorking(values);
  const body: Values = { ...values, isworking: working ? "Y" : "N" };
  if (working) body.todate = "";
  if (body.headphone !== undefined && body.headphone !== null) {
    body.headphone = String(body.headphone).trim();
  }
  return body;
};

/** A typed business type has no id, so its name is the one to show. */
const businessTypeOf = (row: ExperienceEntry) =>
  (Number(row.businesstypeid) > 0 ? row.businesstypename : row.businesstypenametext) ||
  row.businesstypename ||
  row.businesstypenametext ||
  "";

/** "2021-03-01 – одоог хүртэл" */
const periodOf = (row: ExperienceEntry) => {
  // The ERP hands dates back as datetimes; a date it cannot read shows as sent.
  const date = (value: unknown) => toIsoDate(value) || String(value ?? "").trim();
  const [from, to] = [date(row.fromdate), date(row.todate)];
  const until = row.isworking === "Y" || !to ? "одоог хүртэл" : to;
  return from ? `${from} – ${until}` : until === "одоог хүртэл" ? "Одоо ажиллаж байгаа" : `– ${until}`;
};

export default function ExperiencePage() {
  return (
    <SectionManager<ExperienceEntry>
      title="Ажлын туршлага"
      description="Сүүлийн ажлаас эхлэн бичнэ үү."
      resource={sections.experience}
      fields={fields}
      defaults={{ isworking: "N" }}
      edit={experienceEdit}
      payload={experiencePayload}
      primary={(row) => row.orgname || "Байгууллага"}
      secondary={(row) =>
        [row.jobname, businessTypeOf(row), periodOf(row)].filter(Boolean).join(" · ")
      }
      emptyText="Ажлын туршлагын мэдээлэл алга."
    />
  );
}
