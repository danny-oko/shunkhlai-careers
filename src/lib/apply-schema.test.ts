// @vitest-environment jsdom

import { describe, expect, it } from "vitest";

import {
  PHONE_PATTERN,
  REGISTER_ID_PATTERN,
  MAX_SALARY_LEVEL_KEY,
  applicationSchema,
  salaryLevelKeySchema,
} from "./apply-schema";

/**
 * This schema is the gate in front of real applicant data. Loosening a
 * pattern here is a security change wearing the clothes of a
 * cleanup, so the boundaries are pinned down.
 */

function values(over: Record<string, unknown> = {}) {
  return {
    fullName: "Батбаяр Дорж",
    email: "batbayar@example.mn",
    phone: "99112233",
    registerId: "УБ99112233",
    note: "",
    ...over,
  };
}

describe("REGISTER_ID_PATTERN", () => {
  it("accepts two Cyrillic letters and eight digits", () => {
    for (const id of ["УБ99112233", "ЖА00000000", "ӨӨ12345678", "ҮҮ87654321"]) {
      expect(REGISTER_ID_PATTERN.test(id)).toBe(true);
    }
  });

  it("rejects Latin lookalikes", () => {
    // YB and УБ look identical in most faces. Accepting the Latin spelling
    // would send an unusable register number to the backend.
    expect(REGISTER_ID_PATTERN.test("YB99112233")).toBe(false);
    expect(REGISTER_ID_PATTERN.test("AB99112233")).toBe(false);
  });

  it("rejects the wrong shape", () => {
    for (const id of ["УБ9911223", "УБ991122334", "У99112233", "УБВ9911223", ""]) {
      expect(REGISTER_ID_PATTERN.test(id)).toBe(false);
    }
  });
});

describe("PHONE_PATTERN", () => {
  it("accepts the spellings people actually type", () => {
    for (const phone of [
      "99112233",
      "9911 2233",
      "9911-2233",
      "+97699112233",
      "+976 9911 2233",
      "976-9911-2233",
    ]) {
      expect(PHONE_PATTERN.test(phone)).toBe(true);
    }
  });

  it("rejects the wrong digit count", () => {
    for (const phone of ["9911223", "991122334", "", "abcdefgh"]) {
      expect(PHONE_PATTERN.test(phone)).toBe(false);
    }
  });
});

describe("applicationSchema", () => {
  it("accepts a complete application", () => {
    expect(applicationSchema.safeParse(values()).success).toBe(true);
  });

  it("upper-cases the register id so casing never reaches the backend", () => {
    const parsed = applicationSchema.parse(values({ registerId: "уб99112233" }));
    expect(parsed.registerId).toBe("УБ99112233");
  });

  it("rejects a bad email, phone or register id", () => {
    for (const bad of [
      { email: "not-an-email" },
      { phone: "123" },
      { registerId: "YB99112233" },
      { fullName: "Б" },
    ]) {
      expect(applicationSchema.safeParse(values(bad)).success).toBe(false);
    }
  });

  it("caps the note so a paste cannot blow past the backend's column", () => {
    expect(applicationSchema.safeParse(values({ note: "a".repeat(1000) })).success).toBe(true);
    expect(applicationSchema.safeParse(values({ note: "a".repeat(1001) })).success).toBe(false);
  });
});

describe("salaryLevelKeySchema", () => {
  it("accepts band keys", () => {
    for (const key of [1, 5, 23, MAX_SALARY_LEVEL_KEY]) {
      expect(salaryLevelKeySchema.safeParse(key).success).toBe(true);
    }
  });

  it("rejects a tögrög amount (the ORA-01438 overflow) and other non-keys", () => {
    for (const bad of [2000000, 999, 100, 0, -1, 1.5, Number.NaN]) {
      expect(salaryLevelKeySchema.safeParse(bad).success).toBe(false);
    }
  });
});
