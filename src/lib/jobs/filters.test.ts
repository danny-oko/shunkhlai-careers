import { describe, expect, it } from "vitest";

import type { JobFilterData } from "@/lib/api/jobs";

import type { JobListRow } from "@/lib/api/jobs";

import { toJobs } from "./mapper";
import {
  applyFacets,
  companyKey,
  companyOptions,
  companyRows,
  defaultFacets,
  FALLBACK_COMPANIES,
  groupOptions,
  matchesFacets,
  positionTypeOptions,
  workTypeOptions,
} from "./filters";
import { ALL, type Job } from "./types";

/** The job-search facets: what is listed, what it counts, what it matches. */

const COMPANY_NAMES = [
  "Шунхлай ХХК",
  "Шунхлай трейдинг ХХК",
  "Шунхлай петролиум ХХК",
  "Шунхлай говь ХХК",
  "Шунхлай ойл ХХК",
  "ЭсЖиШивээхүрэн депо ХХК",
  "ЭсЖиХанги Гэйт ХХК",
  "SGHOLDING",
];

/** As live `getDropDownData` answers (2026-09-23), trimmed to what is used. */
const filterData = {
  location: [],
  salarylevel: [],
  smcompany: FALLBACK_COMPANIES.map((row) => ({ ...row })),
  hrposgroup: [
    { posgroupid: 47, name: "Үйлдвэрлэлийн үйл ажиллагаа" },
    { posgroupid: 48, name: "Санхүү" },
  ],
  positiontype: [
    { valuestr: 4, name: "Үндсэн" },
    { valuestr: 26, name: "Гэрээт" },
    { valuestr: 46, name: "Цагийн" },
  ],
} as unknown as JobFilterData;

function job(over: Partial<Job> = {}): Job {
  return {
    id: "1",
    slug: "1-a",
    title: "A",
    company: "Шунхлай ХХК",
    companyId: "SHUNKHLAI",
    location: "Шунхлай төв байр",
    positionGroup: "Санхүү",
    positionGroupId: 48,
    workType: "Бүтэн цагийн",
    positionType: "Үндсэн",
    positionTypeId: 4,
    statusId: 1,
    status: "",
    postedAt: "2026.09.01",
    closesAt: "2026.12.01",
    remainingDays: 30,
    isOpen: true,
    ...over,
  };
}

const jobs = [
  job({ id: "1" }),
  job({ id: "2" }),
  job({ id: "3", company: "Шунхлай ойл ХХК", companyId: "SHOIL" }),
  job({
    id: "4",
    company: "Шунхлай говь ХХК",
    companyId: "SHGOBI",
    positionGroupId: 47,
    positionTypeId: 26,
    workType: "Ээлжийн",
  }),
  // Expired: listed nowhere, so counted nowhere.
  job({
    id: "5",
    company: "Шунхлай трейдинг ХХК",
    companyId: "SHTRADING",
    isOpen: false,
    remainingDays: -4,
  }),
];

describe("companyOptions", () => {
  it("lists all eight companies in the ERP's order, whatever is open", () => {
    const options = companyOptions(filterData, jobs);

    expect(options[0]).toMatchObject({ value: ALL, label: "Бүх компани" });
    expect(options.slice(1).map((option) => option.label)).toEqual(COMPANY_NAMES);
    expect(options.slice(1).map((option) => option.value)).toEqual(
      FALLBACK_COMPANIES.map((row) => row.companyid),
    );
  });

  it("counts open postings per companyid, showing 0 rather than hiding", () => {
    const counts = new Map(
      companyOptions(filterData, jobs).map((option) => [option.value, option.count]),
    );

    expect(counts.get(ALL)).toBe(4);
    expect(counts.get("SHUNKHLAI")).toBe(2);
    expect(counts.get("SHOIL")).toBe(1);
    expect(counts.get("SHGOBI")).toBe(1);
    // The one expired posting is not counted for its company.
    expect(counts.get("SHTRADING")).toBe(0);
    expect(counts.get("SGKHANGI")).toBe(0);
    expect(counts.get("SGHOLDING")).toBe(0);
  });

  it("falls back to the built-in list when the dropdown call failed", () => {
    const options = companyOptions(null, jobs);

    expect(options.slice(1).map((option) => option.label)).toEqual(COMPANY_NAMES);
    expect(options.find((option) => option.value === "SHUNKHLAI")?.count).toBe(2);
  });

  it("ignores an empty or malformed live list", () => {
    const broken = { smcompany: [{ companyid: "", name: "" }] } as JobFilterData;

    expect(companyRows(broken)).toEqual(FALLBACK_COMPANIES);
    expect(companyRows({ smcompany: [] } as unknown as JobFilterData)).toEqual(
      FALLBACK_COMPANIES,
    );
  });

  it("matches a row that arrived without a companyid by its name", () => {
    const nameOnly = job({ id: "6", companyId: "", company: "ЭсЖиХанги Гэйт ХХК" });

    expect(companyKey(nameOnly, FALLBACK_COMPANIES)).toBe("SGKHANGI");
    expect(
      companyOptions(filterData, [...jobs, nameOnly]).find(
        (option) => option.value === "SGKHANGI",
      )?.count,
    ).toBe(1);
  });

  it("buckets a row with neither id nor a known name nowhere", () => {
    const stray = job({ id: "7", companyId: "", company: "Огт өөр ХХК" });

    expect(companyKey(stray, FALLBACK_COMPANIES)).toBe("");
    const options = companyOptions(filterData, [stray]);
    expect(options.slice(1).every((option) => option.count === 0)).toBe(true);
  });
});

describe("groupOptions / positionTypeOptions", () => {
  it("keys groups on posgroupid and counts open postings", () => {
    const options = groupOptions(filterData, jobs);

    expect(options.map((option) => option.value)).toEqual([ALL, "47", "48"]);
    expect(options.map((option) => option.count)).toEqual([4, 1, 3]);
  });

  it("drops the /NN/ code prefix a label may carry", () => {
    const prefixed = {
      hrposgroup: [{ posgroupid: 45, name: "/04/ Агуулах, тээвэр түгээлт" }],
    } as unknown as JobFilterData;

    // Kept here only because it is the selected one; see below.
    expect(groupOptions(prefixed, [], "45").at(-1)?.label).toBe("Агуулах, тээвэр түгээлт");
  });

  it("hides the groups nobody is hiring in", () => {
    const idle = {
      hrposgroup: [
        { posgroupid: 47, name: "Үйлдвэрлэлийн үйл ажиллагаа" },
        { posgroupid: 48, name: "Санхүү" },
        { posgroupid: 89, name: "Байгууллагын стратеги" },
      ],
    } as unknown as JobFilterData;

    // 89 has nothing open: a dead row on a rail of 21 groups.
    expect(groupOptions(idle, jobs).map((option) => option.value)).toEqual([
      ALL,
      "47",
      "48",
    ]);
    // …unless it is what the reader picked, which must stay clearable.
    expect(groupOptions(idle, jobs, "89").map((option) => option.value)).toEqual([
      ALL,
      "47",
      "48",
      "89",
    ]);
  });

  it("keys position types on valuestr, which is the rows' postypeid", () => {
    const options = positionTypeOptions(filterData, jobs);

    // "Цагийн" (46) is in the ERP's list but in none of the postings.
    expect(options.map((option) => option.value)).toEqual([ALL, "4", "26"]);
    expect(options.map((option) => option.label)).toEqual([
      "Бүх хэлбэр",
      "Үндсэн",
      "Гэрээт",
    ]);
    expect(options.map((option) => option.count)).toEqual([4, 3, 1]);
    expect(positionTypeOptions(filterData, jobs, "46").at(-1)).toEqual({
      value: "46",
      label: "Цагийн",
      count: 0,
    });
  });

  it("is just the 'all' row when the dropdown call failed", () => {
    expect(groupOptions(null, jobs)).toHaveLength(1);
    expect(positionTypeOptions(null, jobs)).toHaveLength(1);
  });
});

describe("workTypeOptions", () => {
  it("tallies the rows, busiest first, expired ones excluded", () => {
    const options = workTypeOptions(jobs);

    expect(options).toEqual([
      { value: ALL, label: "Бүх төрөл", count: 4 },
      { value: "Бүтэн цагийн", label: "Бүтэн цагийн", count: 3 },
      { value: "Ээлжийн", label: "Ээлжийн", count: 1 },
    ]);
  });
});

describe("matchesFacets", () => {
  it("passes everything open by default", () => {
    expect(applyFacets(jobs, defaultFacets).map((row) => row.id)).toEqual([
      "1",
      "2",
      "3",
      "4",
    ]);
  });

  it("filters companies by companyid, not by display name", () => {
    const facets = { ...defaultFacets, company: "SHOIL" };

    expect(applyFacets(jobs, facets, FALLBACK_COMPANIES).map((row) => row.id)).toEqual([
      "3",
    ]);
    expect(
      matchesFacets(job({ company: "Шунхлай ойл ХХК", companyId: "" }), facets),
    ).toBe(true);
  });

  it("filters by position group and position type id", () => {
    expect(
      applyFacets(jobs, { ...defaultFacets, group: "47" }).map((row) => row.id),
    ).toEqual(["4"]);
    expect(
      applyFacets(jobs, { ...defaultFacets, positionType: "26" }).map((row) => row.id),
    ).toEqual(["4"]);
  });

  it("never lists an expired posting, whatever is selected", () => {
    expect(
      applyFacets(jobs, { ...defaultFacets, company: "SHTRADING" }),
    ).toEqual([]);
  });
});

describe("the live list, as production counts it", () => {
  /**
   * The eleven rows `getRecruitmentOrderList` answered with on 2026-09-23,
   * reduced to what decides openness. Two shapes that the dates get wrong:
   * rows with no `advenddate` that are already in or past selection, and rows
   * months past their `advenddate` that are still accepting applications.
   */
  const live: Array<[number, string, number, string | null, number | null]> = [
    [1062, "SHUNKHLAI", 5, null, null],
    [1022, "SHUNKHLAI", 11, null, null],
    [1026, "SHUNKHLAI", 11, null, null],
    [1023, "SHUNKHLAI", 5, null, null],
    [1025, "SHUNKHLAI", 5, null, null],
    [1024, "SHUNKHLAI", 5, null, null],
    [962, "SHTRADING", 5, "2026.07.03", 82],
    [1002, "SHUNKHLAI", 7, null, null],
    [985, "SHTRADING", 5, "2026.06.25", 90],
    [923, "SHUNKHLAI", 5, "2026.05.29", 117],
    [983, "SHUNKHLAI", 5, "2026.07.18", 67],
  ];

  const rows = live.map(
    ([entryid, companyid, status, advenddate, remainingdays]) =>
      ({
        entryid,
        posname: `Ажлын байр ${entryid}`,
        locname: "Шунхлай төв байр",
        companyname: companyid === "SHTRADING" ? "Шунхлай трейдинг ХХК" : "Шунхлай ХХК",
        companyid,
        postypeid: 4,
        postype: "Үндсэн",
        posgroupid: 47,
        posgroupname: "Үйлдвэрлэлийн үйл ажиллагаа",
        worktype: "Бүтэн цагийн",
        requestdate: "2026.03.01",
        advbegindate: "2026.03.01",
        advenddate,
        status,
        statusname: status === 5 ? "Анкет хүлээн авах" : "Сонгон шалгаруулалт",
        remainingdays,
      }) as JobListRow,
  );
  const liveJobs = toJobs(rows);

  it("counts the companies the way the owner's production page does", () => {
    const counts = new Map(
      companyOptions(filterData, liveJobs).map((option) => [option.value, option.count]),
    );

    expect(counts.get("SHUNKHLAI")).toBe(6);
    expect(counts.get("SHTRADING")).toBe(2);
    expect(counts.get(ALL)).toBe(8);
  });

  it("keeps a posting whose advenddate is months past but still accepting", () => {
    // 923: advenddate 2026.05.29, remainingdays +117, status 5.
    const stale = liveJobs.find((job) => job.id === "923")!;

    expect(stale.isOpen).toBe(true);
    expect(stale.remainingDays).toBe(117);
    expect(applyFacets(liveJobs, defaultFacets).map((job) => job.id)).toContain("923");
  });

  it("drops a posting with no closing date that is already in selection", () => {
    // 1002 (status 7) and 1022 / 1026 (status 11) all arrive open-ended.
    const ids = applyFacets(liveJobs, defaultFacets).map((job) => job.id);

    expect(ids).not.toContain("1002");
    expect(ids).not.toContain("1022");
    expect(ids).not.toContain("1026");
    expect(ids).toHaveLength(8);
  });
});
