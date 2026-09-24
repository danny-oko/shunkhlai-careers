import { describe, expect, it } from "vitest";

import type { DeskApplication, DeskPush } from "@/server/applicant/application-desk";
import {
  ALL,
  applyFilter,
  filterHref,
  isFiltered,
  jobOptions,
  jobValue,
  matches,
  parseFilter,
  statusOptions,
} from "./filters";
import { deskStatus, filterLabel, reasonLabel, REASON_UNKNOWN, deskTime, rowJob, rowName } from "./labels";

/**
 * The filters and the wording, as arithmetic.
 *
 * Both modules are pure by design — the page is a server component that
 * re-renders from the query string, so there is nothing to drive through a
 * browser, and what is worth testing is which rows a pill keeps and what
 * number it prints. No database, no ERP, no React.
 */

const push = (over: Partial<DeskPush> = {}): DeskPush => ({
  status: "sent",
  attempts: 1,
  terminal: false,
  ...over,
});

const row = (over: Partial<DeskApplication> = {}): DeskApplication => ({
  key: "k",
  name: "Дорж Бат",
  jobTitle: "Тээврийн менежер",
  jobId: 786,
  appliedAt: "2026-09-20T00:00:00.000Z",
  erpStatus: "Хүлээгдэж буй",
  push: push(),
  ...over,
});

const ROWS: DeskApplication[] = [
  row({ key: "a", jobId: 786, jobTitle: "Тээврийн менежер", push: push({ status: "sent" }) }),
  row({ key: "b", jobId: 786, jobTitle: "Тээврийн менежер", push: push({ status: "failed", terminal: true, error: "erp_apply_rejected" }) }),
  row({ key: "c", jobId: 787, jobTitle: "Нягтлан бодогч", push: push({ status: "failed", terminal: false, error: "erp_unavailable" }) }),
  row({ key: "d", jobId: 787, jobTitle: "Нягтлан бодогч", push: push({ status: "pending" }) }),
  row({ key: "e", jobId: 787, jobTitle: "Нягтлан бодогч", push: push({ status: "sent" }) }),
];

describe("deskStatus", () => {
  it("splits failed into 'still trying' and 'nobody is trying'", () => {
    expect(deskStatus(push({ status: "failed", terminal: false }))).toBe("retrying");
    expect(deskStatus(push({ status: "failed", terminal: true }))).toBe("attention");
  });

  it("maps the other push states straight through", () => {
    expect(deskStatus(push({ status: "sent" }))).toBe("sent");
    expect(deskStatus(push({ status: "pending" }))).toBe("pending");
    expect(deskStatus(push({ status: "skipped" }))).toBe("skipped");
    expect(deskStatus(push({ status: "unknown" }))).toBe("unknown");
  });
});

describe("parseFilter", () => {
  it("reads both facets", () => {
    expect(parseFilter({ status: "attention", job: "787" })).toEqual({
      status: "attention",
      job: "787",
    });
  });

  it("falls back to the whole list rather than to nothing", () => {
    // A stale bookmark or a hand-typed value should land on every row, not on
    // an empty screen that reads as "no applications".
    expect(parseFilter({ status: "нэгэнт-биш" })).toEqual({ status: ALL, job: ALL });
    expect(parseFilter({})).toEqual({ status: ALL, job: ALL });
  });

  it("takes the first value when a parameter repeats", () => {
    expect(parseFilter({ status: ["sent", "pending"] }).status).toBe("sent");
  });

  it("knows when anything is filtered at all", () => {
    expect(isFiltered({ status: ALL, job: ALL })).toBe(false);
    expect(isFiltered({ status: ALL, job: "786" })).toBe(true);
  });
});

describe("matching", () => {
  it("filters by status", () => {
    expect(applyFilter(ROWS, { status: "sent", job: ALL }).map((r) => r.key)).toEqual(["a", "e"]);
  });

  it("filters by job", () => {
    expect(applyFilter(ROWS, { status: ALL, job: "787" }).map((r) => r.key)).toEqual([
      "c",
      "d",
      "e",
    ]);
  });

  it("applies both together", () => {
    expect(applyFilter(ROWS, { status: "sent", job: "787" }).map((r) => r.key)).toEqual(["e"]);
  });

  it("identifies a posting by id, and by title when it has no id", () => {
    expect(jobValue(row({ jobId: 786 }))).toBe("786");
    expect(jobValue(row({ jobId: 0, jobTitle: "Нярав" }))).toBe("Нярав");
    expect(matches(row({ jobId: 0, jobTitle: "Нярав" }), { status: ALL, job: "Нярав" })).toBe(true);
  });
});

describe("the pills", () => {
  it("counts statuses against the job filter, so the numbers match what a press shows", () => {
    const options = statusOptions(ROWS, { status: ALL, job: "787" }, filterLabel);
    expect(options).toEqual([
      { value: ALL, label: "Бүгд", count: 3 },
      { value: "sent", label: filterLabel("sent"), count: 1 },
      { value: "pending", label: filterLabel("pending"), count: 1 },
      { value: "retrying", label: filterLabel("retrying"), count: 1 },
    ]);
    for (const option of options.slice(1)) {
      expect(applyFilter(ROWS, { status: option.value as never, job: "787" })).toHaveLength(
        option.count,
      );
    }
  });

  it("leaves out states that do not occur, but keeps the one being filtered by", () => {
    const options = statusOptions(ROWS, { status: "skipped", job: ALL }, filterLabel);
    expect(options.map((o) => o.value)).toContain("skipped");
    expect(options.find((o) => o.value === "skipped")?.count).toBe(0);
    expect(options.map((o) => o.value)).not.toContain("unknown");
  });

  it("counts jobs against the status filter, busiest first", () => {
    expect(jobOptions(ROWS, { status: ALL, job: ALL })).toEqual([
      { value: ALL, label: "Бүх ажлын байр", count: 5 },
      { value: "787", label: "Нягтлан бодогч", count: 3 },
      { value: "786", label: "Тээврийн менежер", count: 2 },
    ]);
    expect(jobOptions(ROWS, { status: "sent", job: ALL }).map((o) => o.count)).toEqual([2, 1, 1]);
  });
});

describe("filterHref", () => {
  it("changes one facet and keeps the other", () => {
    expect(filterHref({ status: "attention", job: ALL }, { job: "787" })).toBe(
      "/admin/applications?status=attention&job=787",
    );
  });

  it("drops a facet set back to 'all', and the whole query when nothing is left", () => {
    expect(filterHref({ status: "attention", job: "787" }, { status: ALL })).toBe(
      "/admin/applications?job=787",
    );
    expect(filterHref({ status: "attention", job: "787" }, { status: ALL, job: ALL })).toBe(
      "/admin/applications",
    );
  });
});

describe("the wording", () => {
  it("names every failure from a classified code, and nothing else", () => {
    expect(reasonLabel("erp_apply_rejected")).toBe("ERP хүсэлтийг хүлээж авсангүй");
    expect(reasonLabel("erp_not_configured")).toBe("ERP хаяг тохируулаагүй байна");
    // An upstream message is not a code, so it can only ever come out as this.
    expect(reasonLabel("Бат Доржийн РД УБ99010101 буруу")).toBe(REASON_UNKNOWN);
    expect(reasonLabel(undefined)).toBe(REASON_UNKNOWN);
  });

  it("prints a date-only value without letting a timezone move it", () => {
    expect(deskTime("2026.08.14")).toBe("2026.08.14");
    expect(deskTime("2026-8-4")).toBe("2026.08.04");
    expect(deskTime(undefined)).toBe("—");
  });

  it("falls back to wording rather than to a blank when a row is missing a field", () => {
    expect(rowName(row({ name: "" }))).toBe("Нэр бүртгэгдээгүй");
    expect(rowJob(row({ jobTitle: "", jobId: 786 }))).toBe("Ажлын байр #786");
    expect(rowJob(row({ jobTitle: "", jobId: 0 }))).toBe("Ажлын байр тодорхойгүй");
  });
});
