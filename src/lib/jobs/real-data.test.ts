import { describe, expect, it } from "vitest";

import type { JobDetail as JobDetailDto, JobListRow } from "@/lib/api/jobs";

import filters from "./__fixtures__/filters.json";
import item from "./__fixtures__/item.json";
import itemExpired from "./__fixtures__/item-expired-923.json";
import list from "./__fixtures__/list.json";
import { parseApiDate, toJobDetail, toJobs } from "./mapper";

/** Payloads captured from the live careers.shunkhlai.mn backend. */

describe("live list payload", () => {
  const jobs = toJobs(list.retdata as unknown as JobListRow[]);

  it("maps every row", () => {
    expect(jobs).toHaveLength(list.retdata.length);
  });

  it("fills required fields and parseable dates", () => {
    for (const job of jobs) {
      expect(job.id).toMatch(/^\d+$/);
      expect(job.title).not.toBe("");
      expect(job.company).not.toBe("");
      expect(parseApiDate(job.postedAt)).not.toBeNull();
    }
  });

  it("treats null closing date as open", () => {
    const open = jobs.find((j) => j.remainingDays === null);
    expect(open?.isOpen).toBe(true);
    expect(open?.closesAt).toBe("");
  });
});

describe("live detail payload", () => {
  it("maps a posting that lacks entryid using the requested id", () => {
    const detail = toJobDetail(item.retdata as unknown as JobDetailDto, 1022);
    expect(detail?.id).toBe("1022");
    expect(detail?.title).toBe("Ахлах нягтлан бодогч");
    expect(detail?.salaryLevel).toBe("3,500,000-4,000,000");
    expect(detail?.additional).toBeNull();
    expect(detail?.requirements).toEqual([]);
  });
});

describe("live detail payload, expired posting 923", () => {
  // Captured from the live get-one endpoint: it drops `advenddate` and sends
  // `remainingdays` -114, so the closed state can only come from that count.
  const detail = toJobDetail(itemExpired.retdata as unknown as JobDetailDto, 923);

  it("carries no closing date and a negative count", () => {
    expect(detail?.closesAt).toBe("");
    expect(detail?.remainingDays).toBe(-114);
  });

  it("is closed", () => {
    expect(detail?.isOpen).toBe(false);
  });

  it("leaves the open-ended 1022 detail open", () => {
    expect(toJobDetail(item.retdata as unknown as JobDetailDto, 1022)?.isOpen).toBe(true);
  });
});

describe("live filter payload", () => {
  it("has the dropdown groups the filters read", () => {
    expect(filters.retdata.positiontype.length).toBeGreaterThan(0);
    expect(filters.retdata.salarylevel.length).toBeGreaterThan(0);
  });
});
