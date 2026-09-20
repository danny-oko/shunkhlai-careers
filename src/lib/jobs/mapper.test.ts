import { describe, expect, it } from "vitest";

import type { JobDetail as JobDetailDto, JobListRow } from "@/lib/api/jobs";

import { daysUntilClose, isPostingOpen, parseApiDate, parseJobId, toJob, toJobDetail, toJobs, toSlug } from "./mapper";

/**
 * The mapper is the only file that speaks both the backend's field names and
 * the UI's. A mistake here does not throw — it blanks a field on the careers
 * page — so these tests check the quiet failures, not just the happy path.
 */

function row(overrides: Partial<JobListRow> = {}): JobListRow {
  return {
    entryid: 786,
    posname: "Багаж хариуцсан ажилтан",
    locname: "Төв оффис",
    companyname: "Barloworld Mongolia",
    companyid: "BARLO",
    postypeid: 2006,
    postype: "Үндсэн",
    posgroupid: 142,
    posgroupname: "Инженер, Техник",
    worktype: "Бүтэн цагийн",
    requestdate: "2026.08.20",
    advbegindate: "2026.09.01",
    advenddate: "2026.09.21",
    status: 1,
    statusname: "Нээлттэй",
    remainingdays: 11,
    ...overrides,
  };
}

describe("toSlug", () => {
  it("keeps Mongolian Cyrillic in the readable part", () => {
    // \p{L} covers Cyrillic, so the slug stays legible rather than collapsing
    // to a bare id.
    expect(toSlug(786, "Багаж хариуцсан ажилтан")).toBe(
      "786-багаж-хариуцсан-ажилтан",
    );
  });

  it("collapses punctuation and trims the separators it creates", () => {
    expect(toSlug(12, "ШТС-ын   менежер!")).toBe("12-штс-ын-менежер");
  });

  it("falls back to the bare id when nothing readable survives", () => {
    expect(toSlug(99, "!!!")).toBe("99");
    expect(toSlug(99, "")).toBe("99");
  });

  it("caps the readable part so URLs stay sane", () => {
    const slug = toSlug(5, "а".repeat(200));
    expect(slug.length).toBeLessThanOrEqual(62);
    expect(slug.startsWith("5-")).toBe(true);
  });
});

describe("parseJobId", () => {
  it("reads the id back out of a slug", () => {
    expect(parseJobId("786-багаж-хариуцсан-ажилтан")).toBe("786");
  });

  it("accepts a bare id", () => {
    expect(parseJobId("786")).toBe("786");
  });

  it("rejects anything not starting with digits", () => {
    expect(parseJobId("багаж-786")).toBeNull();
    expect(parseJobId("")).toBeNull();
  });
});

describe("toJob", () => {
  it("maps the backend's field names onto the UI's", () => {
    const job = toJob(row())!;

    expect(job.id).toBe("786");
    expect(job.title).toBe("Багаж хариуцсан ажилтан");
    expect(job.location).toBe("Төв оффис");
    expect(job.positionGroup).toBe("Инженер, Техник");
    expect(job.postedAt).toBe("2026.09.01");
    expect(job.closesAt).toBe("2026.09.21");
  });

  it("drops rows with no id or no title rather than rendering a blank card", () => {
    expect(toJob(row({ entryid: 0 }))).toBeNull();
    expect(toJob(row({ posname: "" }))).toBeNull();
  });

  it("falls back to the request date when the advert has no start date", () => {
    expect(toJob(row({ advbegindate: "" }))!.postedAt).toBe("2026.08.20");
  });

  it("decides open/closed from advenddate, not the list's remainingdays", () => {
    // Live posting 923: closed 2026.05.29, yet the list sent remainingdays +114
    // (wrong sign) and status 5. Expiry is not enforced server-side.
    const expired = toJob(row({ advenddate: "2026.05.29", remainingdays: 114, status: 5 }))!;
    expect(expired.isOpen).toBe(false);
    expect(expired.remainingDays!).toBeLessThan(0);
    // ...and a far-future date is open even when the list claims it expired.
    const live = toJob(row({ advenddate: "2099.01.01", remainingdays: -5 }))!;
    expect(live.isOpen).toBe(true);
    expect(live.remainingDays!).toBeGreaterThan(0);
  });

  it("treats a missing closing date as open-ended, not expiring today", () => {
    // The live backend sends `remainingdays: null` for postings with no
    // `advenddate` at all. Collapsing that to 0 would read as "expires
    // today" for a posting that has no deadline.
    const job = toJob(row({ remainingdays: null, advenddate: null }))!;
    expect(job.isOpen).toBe(true);
    expect(job.remainingDays).toBeNull();
  });
});

describe("toJobs", () => {
  it("filters unusable rows instead of rendering holes", () => {
    const jobs = toJobs([row(), row({ posname: "" }), row({ entryid: 887 })]);
    expect(jobs.map((job) => job.id)).toEqual(["786", "887"]);
  });
});

describe("toJobDetail", () => {
  const dto = (over: Partial<JobDetailDto> = {}): JobDetailDto =>
    ({
      hrrecruitmentorder: [
        { ...row(), salarylevel: " 1.5-2.0 сая ", levelname: "Бакалавр", quantity: 2 },
      ],
      mainresp: [{ name: " Багаж хяналт " }, { name: "" }],
      mainreq: [{ name: "Дээд боловсрол" }],
      ...over,
    }) as JobDetailDto;

  it("reads the parsed arrays and trims blank lines out", () => {
    const detail = toJobDetail(dto())!;

    expect(detail.responsibilities).toEqual(["Багаж хяналт"]);
    expect(detail.requirements).toEqual(["Дээд боловсрол"]);
    expect(detail.salaryLevel).toBe("1.5-2.0 сая");
    expect(detail.quantity).toBe(2);
  });

  it("returns null when the posting record is missing", () => {
    expect(toJobDetail(dto({ hrrecruitmentorder: [] }))).toBeNull();
  });

  it("answers null, not an empty string, for absent optional fields", () => {
    const detail = toJobDetail(
      dto({
        hrrecruitmentorder: [{ ...row(), salarylevel: "   ", quantity: undefined }],
      } as Partial<JobDetailDto>),
    )!;

    expect(detail.salaryLevel).toBeNull();
    expect(detail.quantity).toBeNull();
  });

  it("copes with the requirement arrays being absent entirely", () => {
    const detail = toJobDetail(
      dto({ mainresp: undefined, mainreq: undefined } as Partial<JobDetailDto>),
    )!;

    expect(detail.responsibilities).toEqual([]);
    expect(detail.requirements).toEqual([]);
  });

  it("falls back to the requested id when the order row omits entryid", () => {
    // The live backend's single-order endpoint drops `entryid` from the row
    // (unlike the list endpoint), so a posting like this would otherwise 404.
    const { entryid: _entryid, ...rowWithoutEntryId } = row();
    const detail = toJobDetail(
      dto({ hrrecruitmentorder: [rowWithoutEntryId] } as Partial<JobDetailDto>),
      786,
    )!;

    expect(detail.id).toBe("786");
  });

  it("returns null when neither the row nor the caller has an id", () => {
    const { entryid: _entryid, ...rowWithoutEntryId } = row();
    expect(
      toJobDetail(dto({ hrrecruitmentorder: [rowWithoutEntryId] } as Partial<JobDetailDto>)),
    ).toBeNull();
  });
});

describe("parseApiDate", () => {
  it("reads the backend's dotted format", () => {
    const date = parseApiDate("2026.07.24")!;
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([
      2026, 6, 24,
    ]);
  });

  it("accepts the dash and slash spellings too", () => {
    expect(parseApiDate("2026-07-24")).not.toBeNull();
    expect(parseApiDate("2026/07/24")).not.toBeNull();
  });

  it("returns null for anything unparseable, so sorting falls back quietly", () => {
    for (const value of ["", "24.07.2026", "2026.7.4", "tomorrow"]) {
      expect(parseApiDate(value)).toBeNull();
    }
  });
});

describe("isPostingOpen / daysUntilClose", () => {
  const now = new Date(2026, 8, 20, 15, 30); // 2026-09-20, mid-afternoon

  it("treats the closing day itself as still open", () => {
    // 0 days left is the last day to apply, not the first day closed.
    expect(daysUntilClose("2026.09.20", now)).toBe(0);
    expect(isPostingOpen("2026.09.20", null, now)).toBe(true);
  });

  it("closes the day after", () => {
    expect(daysUntilClose("2026.09.19", now)).toBe(-1);
    expect(isPostingOpen("2026.09.19", 999, now)).toBe(false);
  });

  it("counts days ahead", () => {
    expect(daysUntilClose("2026.09.25", now)).toBe(5);
  });

  it("closes posting 923's shape: past advenddate, positive list remainingdays", () => {
    expect(isPostingOpen("2026.05.29", 114, now)).toBe(false);
    expect(daysUntilClose("2026.05.29", now)).toBe(-114);
  });

  it("treats null / empty advenddate as open-ended", () => {
    expect(isPostingOpen(null, null, now)).toBe(true);
    expect(isPostingOpen("", null, now)).toBe(true);
    expect(daysUntilClose(null, now)).toBeNull();
  });

  it("closes the get-one shape of 923: no advenddate, remainingdays -114", () => {
    expect(isPostingOpen(undefined, -114, now)).toBe(false);
    expect(isPostingOpen("", -114, now)).toBe(false);
    expect(isPostingOpen(null, -1, now)).toBe(false);
  });

  it("keeps a posting with no date and a null/zero/positive/odd count open", () => {
    // 1022's get-one shape: no advenddate, remainingdays null.
    expect(isPostingOpen(undefined, null, now)).toBe(true);
    expect(isPostingOpen(undefined, undefined, now)).toBe(true);
    expect(isPostingOpen(undefined, 0, now)).toBe(true);
    expect(isPostingOpen(undefined, 30, now)).toBe(true);
    expect(isPostingOpen(undefined, Number.NaN, now)).toBe(true);
    expect(isPostingOpen(undefined, Number.NEGATIVE_INFINITY, now)).toBe(true);
  });

  it("lets a readable date beat the count in both directions", () => {
    expect(isPostingOpen("2026.09.25", -5, now)).toBe(true);
    expect(isPostingOpen("2026.09.19", 5, now)).toBe(false);
  });

  it("falls back to remainingdays only for an unreadable date", () => {
    expect(isPostingOpen("soon", -3, now)).toBe(false);
    expect(isPostingOpen("soon", 3, now)).toBe(true);
  });
});
