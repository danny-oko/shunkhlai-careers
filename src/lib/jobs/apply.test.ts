import { describe, expect, it } from "vitest";

import type { ApplicationRow } from "@/lib/api/applications";
import type { JobFilterData } from "@/lib/api/jobs";

import {
  applicationWasCreated,
  buildApplicationInput,
  findDuplicateApplication,
  isPastDate,
  parseSalaryChoice,
  salaryBands,
} from "./apply";

const bands = [
  { key: 1, text: "792,000-1,000,000" },
  { key: 10, text: "3,500,000-4,000,000" },
  { key: 23, text: "20,000,000-с дээш" },
];

const job = { title: "Ахлах нягтлан бодогч", location: "Төв оффис" };

function app(entryid: number, posname = job.title, locname = job.location): ApplicationRow {
  return { entryid, posname, companyname: "Шунхлай ХХК", locname };
}

describe("salaryBands", () => {
  it("reads the API's salarylevel rows and tolerates a missing bundle", () => {
    expect(salaryBands({ salarylevel: bands } as unknown as JobFilterData)).toEqual(bands);
    expect(salaryBands(null)).toEqual([]);
  });
});

describe("parseSalaryChoice", () => {
  it("omits the key when nothing is chosen", () => {
    expect(parseSalaryChoice("", bands)).toEqual({ ok: true, key: undefined });
  });

  it("returns the band key for a listed band", () => {
    expect(parseSalaryChoice("10", bands)).toEqual({ ok: true, key: 10 });
  });

  it("rejects a tögrög amount (the placeholder that overflowed NUMBER(2))", () => {
    expect(parseSalaryChoice("2000000", bands).ok).toBe(false);
  });

  it("rejects a key that is not among the loaded bands", () => {
    expect(parseSalaryChoice("5", bands).ok).toBe(false);
    expect(parseSalaryChoice("abc", bands).ok).toBe(false);
  });
});

describe("buildApplicationInput", () => {
  const base = { postingId: 923, poshiredate: "2026-10-01", recsourceid: 41 };

  it("sends salrequest as the band key plus sourcetype WEB", () => {
    expect(buildApplicationInput({ ...base, salaryKey: 10 })).toEqual({
      recruitmentorderid: 923,
      sourcetype: "WEB",
      salrequest: 10,
      poshiredate: "2026-10-01",
      recsourceid: 41,
    });
  });

  it("leaves salrequest out entirely when unset", () => {
    const body = buildApplicationInput({ ...base, salaryKey: undefined });
    expect("salrequest" in body).toBe(false);
  });
});

describe("isPastDate", () => {
  const now = new Date(2026, 8, 20, 15, 0);
  it("allows today and later, rejects earlier", () => {
    expect(isPastDate("2026-09-20", now)).toBe(false);
    expect(isPastDate("2026-09-21", now)).toBe(false);
    expect(isPastDate("2026-09-19", now)).toBe(true);
  });
  it("does not flag an unparseable value", () => {
    expect(isPastDate("", now)).toBe(false);
  });
});

describe("findDuplicateApplication", () => {
  it("matches by title and location, ignoring case and padding", () => {
    const rows = [app(1, "  ахлах НЯГТЛАН бодогч ", " төв оффис")];
    expect(findDuplicateApplication(rows, job)?.entryid).toBe(1);
  });

  it("does not match the same title at another location, or another title", () => {
    expect(findDuplicateApplication([app(1, job.title, "Дархан")], job)).toBeUndefined();
    expect(findDuplicateApplication([app(2, "Жолооч")], job)).toBeUndefined();
    expect(findDuplicateApplication([], job)).toBeUndefined();
  });
});

describe("applicationWasCreated", () => {
  it("is true when a new matching row appeared", () => {
    expect(applicationWasCreated([app(1, "Жолооч")], [app(1, "Жолооч"), app(2)], job)).toBe(true);
  });

  it("is false for the silent no-op (unknown posting: list unchanged)", () => {
    expect(applicationWasCreated([app(1, "Жолооч")], [app(1, "Жолооч")], job)).toBe(false);
  });

  it("is false when a new row appeared but it is for something else", () => {
    expect(applicationWasCreated([], [app(3, "Жолооч")], job)).toBe(false);
  });
});
