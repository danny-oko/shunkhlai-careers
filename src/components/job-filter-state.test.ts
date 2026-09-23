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
  jobName: "",
  locationId: "",
  salaryLevelId: "",
  groups: opts([["g1", "Санхүү"]]),
  companies: opts([["SHUNKHLAI", "Шунхлай ХХК"]]),
  positionTypes: opts([["4", "Үндсэн"]]),
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
      facets: {
        group: "g1",
        company: "SHUNKHLAI",
        positionType: "4",
        workType: "w1",
      },
      jobName: "  инженер  ",
      locationId: "12",
      salaryLevelId: "3",
    });
    expect(active.map((a) => a.key)).toEqual([
      "search",
      "group",
      "location",
      "salary",
      "company",
      "positionType",
      "workType",
    ]);
    expect(active.map((a) => a.label)).toEqual([
      "«инженер»",
      "Санхүү",
      "Улаанбаатар",
      "1-2 сая",
      "Шунхлай ХХК",
      "Үндсэн",
      "Бүтэн цагийн",
    ]);
  });
  it("ignores a blank search", () => {
    expect(buildActiveFilters({ ...base, jobName: "   " })).toEqual([]);
  });
  it("keeps a stale URL id removable via the section title", () => {
    const active = buildActiveFilters({ ...base, locationId: "999" });
    expect(active).toEqual([
      { key: "location", title: "Байршил", label: "Байршил" },
    ]);
    expect(countActiveFilters({ ...base, locationId: "999" })).toBe(1);
  });
});
