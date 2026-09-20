import { describe, expect, it } from "vitest";

import { encodeSectionValues } from "./section-payload";

const fields = [
  { name: "countryid", type: "select" },
  { name: "universityid", type: "combobox" },
  { name: "gpa", type: "number" },
  { name: "score", type: "text" },
  { name: "todate", type: "date" },
  { name: "levelid", type: "select", emptyAs: "zero" as const },
];

describe("encodeSectionValues", () => {
  it("sends numeric values as numbers", () => {
    const out = encodeSectionValues(fields, { countryid: "496", universityid: "12", gpa: "3.5", levelid: "2" });
    expect(out).toMatchObject({ countryid: 496, universityid: 12, gpa: 3.5, levelid: 2 });
  });

  it("omits an empty numeric field: never null, never a silent 0", () => {
    const out = encodeSectionValues(fields, { countryid: "", universityid: null, gpa: undefined });
    expect("countryid" in out).toBe(false);
    expect("universityid" in out).toBe(false);
    expect("gpa" in out).toBe(false);
    expect(Object.values(out)).not.toContain(null);
  });

  it("sends 0 for a field that opts into emptyAs zero", () => {
    expect(encodeSectionValues(fields, { levelid: "" }).levelid).toBe(0);
    expect(encodeSectionValues(fields, { levelid: null }).levelid).toBe(0);
  });

  it("treats whitespace and non-numeric input as empty", () => {
    const out = encodeSectionValues(fields, { countryid: "  ", gpa: "abc" });
    expect("countryid" in out).toBe(false);
    expect("gpa" in out).toBe(false);
  });

  it("keeps a real 0 that the user or the row carried", () => {
    expect(encodeSectionValues(fields, { gpa: 0 }).gpa).toBe(0);
    expect(encodeSectionValues(fields, { gpa: "0" }).gpa).toBe(0);
  });

  it("does not touch text, date or unknown keys, and defaults entryid to 0", () => {
    const out = encodeSectionValues(fields, { score: "IELTS 6.5", todate: "", extra: null });
    expect(out).toEqual({ entryid: 0, score: "IELTS 6.5", todate: "", extra: null, levelid: 0 });
  });

  it("keeps an existing entryid", () => {
    expect(encodeSectionValues(fields, { entryid: 42 }).entryid).toBe(42);
  });

  it("edit round trip: a row's null / 0 ids blank out and are omitted, not turned into 0 by Number(null)", () => {
    // `null` (nullable column) and `0` (NOT NULL column) both prefill as "".
    const out = encodeSectionValues(fields, { entryid: 7, countryid: "", gpa: null, levelid: 3 });
    expect(out).toEqual({ entryid: 7, levelid: 3 });
  });
});
