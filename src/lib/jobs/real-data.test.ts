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

  it("opens exactly the rows whose status accepts applications", () => {
    const rows = list.retdata as unknown as JobListRow[];
    const accepting = rows.filter((r) => r.status === 5).map((r) => String(r.entryid));

    expect(jobs.filter((job) => job.isOpen).map((job) => job.id)).toEqual(accepting);
    // Not all of them have a closing date: an open-ended advert counts too.
    expect(jobs.some((job) => job.isOpen && job.remainingDays === null)).toBe(true);
  });

  it("never shows a negative countdown", () => {
    for (const job of jobs) {
      if (job.remainingDays !== null) expect(job.remainingDays).toBeGreaterThanOrEqual(0);
    }
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

describe("live detail payload, posting 923", () => {
  // Captured from the live get-one endpoint: it drops `advenddate` and sends
  // `remainingdays` -114 — while the status, here and in the list, is 5
  // "Анкет хүлээн авах". The count was read as "closed 114 days ago"; it is
  // not, and the advert is one of the eight production counts as open.
  const detail = toJobDetail(itemExpired.retdata as unknown as JobDetailDto, 923);

  it("carries no closing date and no countdown", () => {
    expect(detail?.closesAt).toBe("");
    expect(detail?.remainingDays).toBeNull();
  });

  it("is open, because its status accepts applications", () => {
    expect(detail?.status).toBe("Анкет хүлээн авах");
    expect(detail?.isOpen).toBe(true);
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
