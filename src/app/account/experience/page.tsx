"use client";

import { SectionManager, type FieldDef } from "@/components/account/section-manager";
import { reference, sections } from "@/lib/api";
import type { ExperienceEntry } from "@/lib/api/sections";

const fields: FieldDef[] = [
  { name: "orgname", label: "Байгууллагын нэр", type: "text", required: true, wide: true },
  {
    name: "businesstypeid",
    label: "Үйл ажиллагааны чиглэл",
    type: "select",
    load: () => reference.businessTypes(),
  },
  {
    // 1463 rows — searched on the server rather than scrolled.
    name: "jobid",
    label: "Албан тушаал",
    type: "combobox",
    required: true,
    load: (_values, query) => reference.jobTitles(query),
  },
  { name: "fromdate", label: "Эхэлсэн", type: "date", required: true },
  { name: "todate", label: "Дууссан", type: "date" },
  { name: "isworking", label: "Одоо ажиллаж байгаа", type: "yesno" },
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

export default function ExperiencePage() {
  return (
    <SectionManager<ExperienceEntry>
      title="Ажлын туршлага"
      description="Сүүлийн ажлаас эхлэн бичнэ үү."
      resource={sections.experience}
      fields={fields}
      defaults={{ isworking: "N" }}
      primary={(row) => row.orgname || "Байгууллага"}
      secondary={(row) =>
        [
          row.jobname,
          [row.fromdate, row.isworking === "Y" ? "одоо" : row.todate]
            .filter(Boolean)
            .join(" - "),
        ]
          .filter(Boolean)
          .join(" · ")
      }
      emptyText="Ажлын туршлагын мэдээлэл алга."
    />
  );
}
