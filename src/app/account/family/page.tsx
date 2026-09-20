"use client";

import { SectionManager, type FieldDef } from "@/components/account/section-manager";
import { reference, sections } from "@/lib/api";
import type { FamilyEntry } from "@/lib/api/sections";

/**
 * Only these four persist: the backend answers success for every other family
 * field and silently drops it, so the form does not offer them.
 */
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
  { name: "phone", label: "Холбоо барих утас", type: "text" },
];

export default function FamilyPage() {
  return (
    <SectionManager<FamilyEntry>
      title="Гэр бүлийн мэдээлэл"
      description="Гэр бүлийн гишүүдийн мэдээллийг оруулна уу."
      resource={sections.family}
      fields={fields}
      defaults={{}}
      primary={(row) => [row.lastname, row.firstname].filter(Boolean).join(" ") || "Гишүүн"}
      secondary={(row) => [row.relativename, row.phone].filter(Boolean).join(" · ")}
      emptyText="Гэр бүлийн мэдээлэл алга."
    />
  );
}
