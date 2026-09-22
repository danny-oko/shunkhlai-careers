import { describe, expect, it } from "vitest";
import { ALL } from "@/lib/jobs/types";
import { defaultFacets } from "@/lib/jobs/filters";
import {
  buildActiveFilters,
  countActiveFilters,
  selectedLabel,
  type ActiveFilterInput,
} from "./job-filter-state";

const opts = (pairs: [string, string][]) => [
  { value: ALL, label: "Бүгд" },
  ...pairs.map(([value, label]) => ({ value, label })),
];

const base: ActiveFilterInput = {
  facets: defaultFacets,
  locationId: "",
  salaryLevelId: "",
  groups: opts([["g1", "Санхүү"]]),
  companies: opts([["c1", "Шунхлай"]]),
  workTypes: opts([["w1", "Бүтэн цагийн"]]),
  locations: opts([["12", "Улаанбаатар"]]),
  salaryLevels: opts([["3", "1-2 сая"]]),
};

describe("selectedLabel", () => {
  it("returns null for empty and ALL", () => {
    expect(selectedLabel(base.groups, "")).toBeNull();
    expect(selectedLabel(base.groups, ALL)).toBeNull();
  });
  it("finds the label, null when unknown", () => {
    expect(selectedLabel(base.groups, "g1")).toBe("Санхүү");
    expect(selectedLabel(base.groups, "nope")).toBeNull();
  });
});

describe("buildActiveFilters", () => {
  it("is empty by default", () => {
    expect(buildActiveFilters(base)).toEqual([]);
    expect(countActiveFilters(base)).toBe(0);
  });
  it("lists every active filter in section order", () => {
    const active = buildActiveFilters({
      ...base,
      facets: { group: "g1", company: "c1", workType: "w1" },
      locationId: "12",
      salaryLevelId: "3",
    });
    expect(active.map((a) => a.key)).toEqual([
      "group",
      "location",
      "salary",
      "company",
      "workType",
    ]);
    expect(active.map((a) => a.label)).toEqual([
      "Санхүү",
      "Улаанбаатар",
      "1-2 сая",
      "Шунхлай",
      "Бүтэн цагийн",
    ]);
  });
  it("keeps a stale URL id removable via the section title", () => {
    const active = buildActiveFilters({ ...base, locationId: "999" });
    expect(active).toEqual([
      { key: "location", title: "Байршил", label: "Байршил" },
    ]);
    expect(countActiveFilters({ ...base, locationId: "999" })).toBe(1);
  });
});
