import { describe, expect, it } from "vitest";

import { initialValues, toIsoDate } from "./section-values";

describe("toIsoDate", () => {
  it("passes ISO dates through", () => {
    expect(toIsoDate("2022-06-01")).toBe("2022-06-01");
  });

  it("reads the dotted audit style, with or without a time", () => {
    expect(toIsoDate("2022.06.01")).toBe("2022-06-01");
    expect(toIsoDate("2022.06.01 13:45:10")).toBe("2022-06-01");
  });

  it("drops the time from an ISO datetime", () => {
    expect(toIsoDate("2022-06-01T00:00:00")).toBe("2022-06-01");
    expect(toIsoDate("2022-06-01T10:00:00.000Z")).toBe("2022-06-01");
  });

  it("returns empty for anything else", () => {
    for (const bad of ["", "  ", "June 2022", "2022-13-01", "2022-02-31", "01.06.2022", null, undefined, 20220601]) {
      expect(toIsoDate(bad)).toBe("");
    }
  });
});

const fields = [
  { name: "countryid", type: "select" },
  { name: "universityid", type: "combobox" },
  { name: "todate", type: "date" },
  { name: "gpa", type: "number" },
];

describe("initialValues", () => {
  it("applies defaults to a new entry only", () => {
    expect(initialValues(fields, { countryid: "496" }, "new")).toEqual({
      countryid: "496",
      entryid: 0,
    });
  });

  it("does not let defaults fill a saved row's missing keys", () => {
    const row = { entryid: 7, universityid: 3 };
    expect(initialValues(fields, { countryid: "496" }, row)).toEqual(row);
  });

  it("treats 0 ids as empty for select and combobox fields", () => {
    const out = initialValues(fields, {}, { entryid: 7, countryid: 0, universityid: "0", gpa: 0 });
    expect(out.countryid).toBe("");
    expect(out.universityid).toBe("");
    expect(out.gpa).toBe(0);
  });

  it("keeps real ids and normalises dates", () => {
    const out = initialValues(fields, {}, { entryid: 7, countryid: 496, todate: "2022.06.01 00:00:00" });
    expect(out.countryid).toBe(496);
    expect(out.todate).toBe("2022-06-01");
  });
});
