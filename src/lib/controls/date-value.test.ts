import { describe, expect, it } from "vitest";

import {
  dateFromValue,
  formatDateDisplay,
  isWithinBounds,
  normalizeDateValue,
  todayValue,
  valueFromDate,
  yearRange,
} from "./date-value";

describe("normalizeDateValue", () => {
  it("passes ISO through and reads dotted and datetime shapes", () => {
    expect(normalizeDateValue("2022-06-01")).toBe("2022-06-01");
    expect(normalizeDateValue("2022.06.01")).toBe("2022-06-01");
    expect(normalizeDateValue("2022.06.01 13:45:10")).toBe("2022-06-01");
    expect(normalizeDateValue("2022-06-01T10:00:00.000Z")).toBe("2022-06-01");
  });

  it("returns empty for anything unreadable or impossible", () => {
    for (const bad of ["", " ", "June 2022", "2022-13-01", "2022-02-31", "01.06.2022", null, undefined, 20220601]) {
      expect(normalizeDateValue(bad)).toBe("");
    }
  });

  it("accepts a real leap day and rejects a false one", () => {
    expect(normalizeDateValue("2024-02-29")).toBe("2024-02-29");
    expect(normalizeDateValue("2023-02-29")).toBe("");
  });
});

describe("dateFromValue / valueFromDate", () => {
  it("round-trips in local time, not UTC", () => {
    const date = dateFromValue("2024-01-01");
    expect(date?.getFullYear()).toBe(2024);
    expect(date?.getMonth()).toBe(0);
    expect(date?.getDate()).toBe(1);
    expect(valueFromDate(date as Date)).toBe("2024-01-01");
  });

  it("is undefined for an empty or bad value", () => {
    expect(dateFromValue("")).toBeUndefined();
    expect(dateFromValue("nope")).toBeUndefined();
  });

  it("zero-pads month and day", () => {
    expect(valueFromDate(new Date(2024, 2, 5))).toBe("2024-03-05");
  });
});

describe("formatDateDisplay", () => {
  it("shows yyyy.mm.dd for ISO and dotted input, and empty otherwise", () => {
    expect(formatDateDisplay("2022-06-01")).toBe("2022.06.01");
    expect(formatDateDisplay("2022.06.01")).toBe("2022.06.01");
    expect(formatDateDisplay("")).toBe("");
    expect(formatDateDisplay("garbage")).toBe("");
  });
});

describe("todayValue", () => {
  it("formats the given day", () => {
    expect(todayValue(new Date(2026, 8, 21))).toBe("2026-09-21");
  });
});

describe("isWithinBounds", () => {
  it("is inclusive at both ends", () => {
    expect(isWithinBounds("2024-05-01", "2024-05-01", "2024-05-31")).toBe(true);
    expect(isWithinBounds("2024-05-31", "2024-05-01", "2024-05-31")).toBe(true);
    expect(isWithinBounds("2024-04-30", "2024-05-01", "2024-05-31")).toBe(false);
    expect(isWithinBounds("2024-06-01", "2024-05-01", "2024-05-31")).toBe(false);
  });

  it("treats missing bounds as open and an unreadable value as outside", () => {
    expect(isWithinBounds("2024-05-01")).toBe(true);
    expect(isWithinBounds("", "2024-05-01")).toBe(false);
  });
});

describe("yearRange", () => {
  it("spans 100 years back and 10 ahead by default", () => {
    expect(yearRange({ nowYear: 2026 })).toEqual({ from: 1926, to: 2036 });
  });

  it("follows min and max", () => {
    expect(yearRange({ min: "2000-01-01", max: "2030-12-31", nowYear: 2026 })).toEqual({ from: 2000, to: 2030 });
  });

  it("widens to include a saved value outside the window", () => {
    expect(yearRange({ value: "1900-05-05", nowYear: 2026 }).from).toBe(1900);
    expect(yearRange({ value: "2100-05-05", nowYear: 2026 }).to).toBe(2100);
  });
});
